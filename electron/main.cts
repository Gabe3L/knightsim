import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron';
import { MODEL_ID_PATTERN, serializeModelOperation } from './modelLibrary.cjs';
import { RobotModelStore } from './modelStore.cjs';

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

let modelStore: RobotModelStore;

function registerRobotModelIpc(): void {
  ipcMain.handle('robot-models:list', () => serializeModelOperation(() => modelStore.list()));
  ipcMain.handle('robot-models:choose-directory', async (event) => {
    const directory = await serializeModelOperation(() => modelStore.getDirectory());
    const options: Electron.OpenDialogOptions = {
      title: 'Choose model folder',
      buttonLabel: 'Use model folder',
      defaultPath: directory,
      properties: ['openDirectory'],
    };
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    return serializeModelOperation(() => modelStore.setDirectory(result.filePaths[0]));
  });
  ipcMain.handle('robot-models:reset-directory', () => serializeModelOperation(() => modelStore.setDirectory(null)));
  ipcMain.handle('robot-models:set-for-robot', (_event, robotId: unknown, id: unknown) => (
    serializeModelOperation(() => modelStore.setForRobot(robotId, id))
  ));
  ipcMain.handle('robot-models:update-orientation', (_event, id: unknown, orientation: unknown) => (
    serializeModelOperation(() => modelStore.updateOrientation(id, orientation))
  ));
}

function registerRobotModelProtocol(): void {
  protocol.handle(MODEL_PROTOCOL, async (request) => {
    try {
      const url = new URL(request.url);
      const id = decodeURIComponent(url.pathname.slice(1)).replace(/\.glb$/i, '');
      if (url.hostname !== 'robot' || !MODEL_ID_PATTERN.test(id)) {
        return new Response('Not found', { status: 404 });
      }
      const sourcePath = await serializeModelOperation(() => modelStore.resolveModel(id));
      if (!sourcePath) return new Response('Not found', { status: 404 });
      const response = await net.fetch(pathToFileURL(sourcePath).toString());
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Content-Type', 'model/gltf-binary');
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response('Model unavailable', { status: 404 });
    }
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
  modelStore = new RobotModelStore(
    path.join(app.getAppPath(), 'models'),
    path.join(app.getPath('userData'), 'robot-models', 'library.json'),
  );
  registerRobotModelIpc();
  registerRobotModelProtocol();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
