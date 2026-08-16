import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const isWindows = process.platform === 'win32';
const appIcon = path.join(__dirname, '../src/assets/app-icon.png');

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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
