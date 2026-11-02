import { validateGlb } from './validateGlb.cjs';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron';

import {
  EMPTY_MODEL_LIBRARY, MODEL_ID_PATTERN, isRecord, isRobotId, normalizeOrientation,
  normalizeModelLibrary, serializeModelOperation,
  type RobotModelLibrary, type RobotModelRecord,
} from './modelLibrary.cjs';

// Prefer the discrete GPU on hybrid Windows/macOS systems. Hardware acceleration
// remains enabled by Electron, and the WebGL context also requests this preference.
app.commandLine.appendSwitch('force_high_performance_gpu');

const MODEL_PROTOCOL = 'knightsim-model';

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

async function readModelLibrary(): Promise<RobotModelLibrary> {
  try {
    return normalizeModelLibrary(JSON.parse(await readFile(modelLibraryPath(), 'utf8')));
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return EMPTY_MODEL_LIBRARY;
    throw new Error('Unable to read the robot model library. Restore or repair library.json before making changes.', { cause: error });
  }
}

async function writeModelLibrary(library: RobotModelLibrary): Promise<void> {
  await mkdir(modelDirectory(), { recursive: true });
  const temporaryPath = `${modelLibraryPath()}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(library, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, modelLibraryPath());
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
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
  ipcMain.handle('robot-models:list', () => serializeModelOperation(readModelLibrary));
  ipcMain.handle('robot-models:import', (event, robotId: unknown) => (
    serializeModelOperation(() => importRobotModel(BrowserWindow.fromWebContents(event.sender) ?? undefined, robotId))
  ));
  ipcMain.handle('robot-models:set-for-robot', (_event, robotId: unknown, id: unknown) => serializeModelOperation(async () => {
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
  }));
  ipcMain.handle('robot-models:update-orientation', (_event, id: unknown, orientation: unknown) => serializeModelOperation(async () => {
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
  }));
  ipcMain.handle('robot-models:remove', (_event, id: unknown) => serializeModelOperation(async () => {
    if (typeof id !== 'string') throw new Error('Invalid robot model identifier.');
    const current = await readModelLibrary();
    const models = current.models.filter((model) => model.id !== id);
    if (models.length === current.models.length) throw new Error('That robot model is no longer available.');
    const next: RobotModelLibrary = {
      version: 2,
      models,
      modelIdByRobot: Object.fromEntries(Object.entries(current.modelIdByRobot).map(([robotId, modelId]) => [
        robotId, modelId === id ? null : modelId,
      ])),
    };
    await writeModelLibrary(next);
    await unlink(modelFilePath(id)).catch((error: unknown) => {
      if (!isRecord(error) || error.code !== 'ENOENT') console.error('Unable to remove a robot model file:', error);
    });
    return next;
  }));
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
