import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('knightSim', {
  platform: process.platform,
  versions: Object.freeze({ electron: process.versions.electron }),
});

export {};
