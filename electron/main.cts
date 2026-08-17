import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron';

// Prefer the discrete GPU on hybrid Windows/macOS systems. Hardware acceleration
// remains enabled by Electron, and the WebGL context also requests this preference.
app.commandLine.appendSwitch('force_high_performance_gpu');

type Axis = 'x' | 'y' | 'z';
type RobotId = 'sentry' | 'infantry' | 'hero';

const ROBOT_IDS: readonly RobotId[] = ['sentry', 'infantry', 'hero'];

interface RobotModelOrientation {
  readonly rotationDeg: Record<Axis, number>;
  readonly flipped: Record<Axis, boolean>;
}

interface RobotModelRecord {
  readonly id: string;
  readonly name: string;
  readonly sourceFileName: string;
  readonly sizeBytes: number;
  readonly importedAt: string;
  readonly orientation: RobotModelOrientation;
}

interface RobotModelLibrary {
  readonly version: 2;
  readonly modelIdByRobot: Readonly<Record<RobotId, string | null>>;
  readonly models: readonly RobotModelRecord[];
}

const EMPTY_MODEL_LIBRARY: RobotModelLibrary = {
  version: 2,
  modelIdByRobot: { sentry: null, infantry: null, hero: null },
  models: [],
};

const MODEL_PROTOCOL = 'knightsim-model';
const MODEL_ID_PATTERN = /^[0-9a-f-]{36}$/;

protocol.registerSchemesAsPrivileged([
  {
    scheme: MODEL_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const isWindows = process.platform === 'win32';
const appIcon = path.join(__dirname, '../src/assets/app-icon.png');

const modelDirectory = (): string => path.join(app.getPath('userData'), 'robot-models');
const modelLibraryPath = (): string => path.join(modelDirectory(), 'library.json');
const modelFilePath = (id: string): string => path.join(modelDirectory(), `${id}.glb`);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isRobotId = (value: unknown): value is RobotId => (
  typeof value === 'string' && ROBOT_IDS.includes(value as RobotId)
);

function normalizeOrientation(value: unknown): RobotModelOrientation {
  const orientation = isRecord(value) ? value : {};
  const rotation = isRecord(orientation.rotationDeg) ? orientation.rotationDeg : {};
  const flipped = isRecord(orientation.flipped) ? orientation.flipped : {};
  const normalizeRotation = (axis: Axis): number => {
    const candidate = rotation[axis];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) return 0;
    return ((Math.round(candidate / 90) * 90) % 360 + 360) % 360;
  };
  return {
    rotationDeg: { x: normalizeRotation('x'), y: normalizeRotation('y'), z: normalizeRotation('z') },
    flipped: {
      x: flipped.x === true,
      y: flipped.y === true,
      z: flipped.z === true,
    },
  };
}

function normalizeModel(value: unknown): RobotModelRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || !MODEL_ID_PATTERN.test(value.id)) return null;
  if (typeof value.name !== 'string' || typeof value.sourceFileName !== 'string') return null;
  if (typeof value.sizeBytes !== 'number' || !Number.isFinite(value.sizeBytes)) return null;
  if (typeof value.importedAt !== 'string') return null;
  return {
    id: value.id,
    name: value.name,
    sourceFileName: value.sourceFileName,
    sizeBytes: Math.max(0, Math.round(value.sizeBytes)),
    importedAt: value.importedAt,
    orientation: normalizeOrientation(value.orientation),
  };
}

async function readModelLibrary(): Promise<RobotModelLibrary> {
  try {
    const parsed: unknown = JSON.parse(await readFile(modelLibraryPath(), 'utf8'));
    if (!isRecord(parsed) || !Array.isArray(parsed.models)) return EMPTY_MODEL_LIBRARY;
    const models = parsed.models.map(normalizeModel).filter((model): model is RobotModelRecord => model !== null);
    const legacyModelId = typeof parsed.activeModelId === 'string'
      && models.some((model) => model.id === parsed.activeModelId)
      ? parsed.activeModelId
      : models[0]?.id ?? null;
    const storedAssignments = isRecord(parsed.modelIdByRobot) ? parsed.modelIdByRobot : null;
    const modelIdByRobot = Object.fromEntries(ROBOT_IDS.map((robotId) => {
      const candidate = storedAssignments?.[robotId];
      const modelId = typeof candidate === 'string' && models.some((model) => model.id === candidate)
        ? candidate
        : storedAssignments ? null : legacyModelId;
      return [robotId, modelId];
    })) as Record<RobotId, string | null>;
    return { version: 2, modelIdByRobot, models };
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return EMPTY_MODEL_LIBRARY;
    console.error('Unable to read the robot model library:', error);
    return EMPTY_MODEL_LIBRARY;
  }
}

async function writeModelLibrary(library: RobotModelLibrary): Promise<void> {
  await mkdir(modelDirectory(), { recursive: true });
  await writeFile(modelLibraryPath(), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

async function validateGlb(filePath: string): Promise<number> {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || fileStats.size < 12) throw new Error('The selected file is not a valid GLB model.');

  const file = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    await file.read(header, 0, header.length, 0);
    const declaredLength = header.readUInt32LE(8);
    if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2 || declaredLength !== fileStats.size) {
      throw new Error('KnightSim supports glTF 2.0 binary (.glb) models only.');
    }

    const chunkHeader = Buffer.alloc(8);
    await file.read(chunkHeader, 0, chunkHeader.length, 12);
    const jsonLength = chunkHeader.readUInt32LE(0);
    const jsonChunkType = chunkHeader.readUInt32LE(4);
    if (jsonChunkType !== 0x4e4f534a || jsonLength > fileStats.size - 20) {
      throw new Error('The selected file has an invalid glTF data section.');
    }
    const jsonBuffer = Buffer.alloc(jsonLength);
    await file.read(jsonBuffer, 0, jsonLength, 20);
    try {
      JSON.parse(jsonBuffer.toString('utf8').replace(/\0+$/u, '').trim());
    } catch {
      throw new Error('The selected file has an invalid glTF data section.');
    }
  } finally {
    await file.close();
  }

  return fileStats.size;
}

async function importRobotModel(
  owner: BrowserWindow | undefined,
  robotId: unknown,
): Promise<RobotModelLibrary | null> {
  if (!isRobotId(robotId)) throw new Error('Invalid robot identifier.');
  const options: Electron.OpenDialogOptions = {
    title: 'Import robot model',
    buttonLabel: 'Import model',
    properties: ['openFile'],
    filters: [{ name: 'glTF binary model', extensions: ['glb'] }],
  };
  const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
  const sourcePath = result.filePaths[0];
  if (result.canceled || !sourcePath) return null;
  if (path.extname(sourcePath).toLowerCase() !== '.glb') throw new Error('Choose a .glb robot model.');

  const sizeBytes = await validateGlb(sourcePath);
  const id = randomUUID();
  const sourceFileName = path.basename(sourcePath);
  const name = path.basename(sourceFileName, path.extname(sourceFileName));
  const model: RobotModelRecord = {
    id,
    name,
    sourceFileName,
    sizeBytes,
    importedAt: new Date().toISOString(),
    orientation: normalizeOrientation(null),
  };

  await mkdir(modelDirectory(), { recursive: true });
  const destination = modelFilePath(id);
  await copyFile(sourcePath, destination);
  try {
    const current = await readModelLibrary();
    const next: RobotModelLibrary = {
      version: 2,
      modelIdByRobot: { ...current.modelIdByRobot, [robotId]: id },
      models: [...current.models, model],
    };
    await writeModelLibrary(next);
    return next;
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    throw error;
  }
}

function registerRobotModelIpc(): void {
  ipcMain.handle('robot-models:list', () => readModelLibrary());
  ipcMain.handle('robot-models:import', (event, robotId: unknown) => (
    importRobotModel(BrowserWindow.fromWebContents(event.sender) ?? undefined, robotId)
  ));
  ipcMain.handle('robot-models:set-for-robot', async (_event, robotId: unknown, id: unknown) => {
    if (!isRobotId(robotId)) throw new Error('Invalid robot identifier.');
    const current = await readModelLibrary();
    if (id !== null && (typeof id !== 'string' || !current.models.some((model) => model.id === id))) {
      throw new Error('That robot model is no longer available.');
    }
    const next = {
      ...current,
      modelIdByRobot: { ...current.modelIdByRobot, [robotId]: id },
    } satisfies RobotModelLibrary;
    await writeModelLibrary(next);
    return next;
  });
  ipcMain.handle('robot-models:update-orientation', async (_event, id: unknown, orientation: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid robot model identifier.');
    const current = await readModelLibrary();
    if (!current.models.some((model) => model.id === id)) throw new Error('That robot model is no longer available.');
    const next = {
      ...current,
      models: current.models.map((model) => (
        model.id === id ? { ...model, orientation: normalizeOrientation(orientation) } : model
      )),
    } satisfies RobotModelLibrary;
    await writeModelLibrary(next);
    return next;
  });
  ipcMain.handle('robot-models:remove', async (_event, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid robot model identifier.');
    const current = await readModelLibrary();
    const models = current.models.filter((model) => model.id !== id);
    if (models.length === current.models.length) throw new Error('That robot model is no longer available.');
    const next: RobotModelLibrary = {
      version: 2,
      models,
      modelIdByRobot: Object.fromEntries(ROBOT_IDS.map((robotId) => [
        robotId,
        current.modelIdByRobot[robotId] === id ? null : current.modelIdByRobot[robotId],
      ])) as Record<RobotId, string | null>,
    };
    await writeModelLibrary(next);
    await unlink(modelFilePath(id)).catch((error: unknown) => {
      if (!isRecord(error) || error.code !== 'ENOENT') console.error('Unable to remove a robot model file:', error);
    });
    return next;
  });
}

async function registerRobotModelProtocol(): Promise<void> {
  await protocol.handle(MODEL_PROTOCOL, async (request) => {
    const url = new URL(request.url);
    const id = decodeURIComponent(url.pathname.slice(1)).replace(/\.glb$/i, '');
    if (url.hostname !== 'robot' || !MODEL_ID_PATTERN.test(id)) {
      return new Response('Not found', { status: 404 });
    }
    const library = await readModelLibrary();
    if (!library.models.some((model) => model.id === id)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(modelFilePath(id)).toString());
  });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 930,
    minWidth: 1040,
    minHeight: 700,
    icon: appIcon,
    backgroundColor: '#090b10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : isWindows ? 'hidden' : 'default',
    ...(isWindows ? {
      titleBarOverlay: {
        color: '#0b0e14',
        symbolColor: '#aeb6c1',
        height: 42,
      },
    } : {}),
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 14 } } : {}),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const notifyFullScreenChange = (isFullScreen: boolean): void => {
    window.webContents.send('window-state:full-screen-changed', isFullScreen);
  };
  window.on('enter-full-screen', () => notifyFullScreenChange(true));
  window.on('leave-full-screen', () => notifyFullScreenChange(false));

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const allowedOrigin = isDevelopment ? process.env.VITE_DEV_SERVER_URL : 'file://';
    if (!url.startsWith(allowedOrigin ?? 'file://')) event.preventDefault();
  });

  if (isDevelopment) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    void window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  if (isWindows) Menu.setApplicationMenu(null);
  ipcMain.handle('window-state:is-full-screen', (event) => (
    BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  ));
  registerRobotModelIpc();
  void registerRobotModelProtocol();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
