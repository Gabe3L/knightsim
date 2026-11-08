import { contextBridge, ipcRenderer } from 'electron';
import type { AppUpdateState } from './updateTypes.cjs';

contextBridge.exposeInMainWorld('knightSim', {
  platform: process.platform,
  versions: Object.freeze({ electron: process.versions.electron }),
  updates: Object.freeze({
    getState: () => ipcRenderer.invoke('app-updates:state'),
    check: () => ipcRenderer.invoke('app-updates:check'),
    install: () => ipcRenderer.invoke('app-updates:install'),
    onChange: (listener: (state: AppUpdateState) => void) => {
      const handleChange = (_event: Electron.IpcRendererEvent, state: AppUpdateState): void => listener(state);
      ipcRenderer.on('app-updates:changed', handleChange);
      return () => ipcRenderer.removeListener('app-updates:changed', handleChange);
    },
  }),
  windowState: Object.freeze({
    isFullScreen: () => ipcRenderer.invoke('window-state:is-full-screen'),
    onFullScreenChange: (listener: (isFullScreen: boolean) => void) => {
      const handleChange = (_event: Electron.IpcRendererEvent, isFullScreen: boolean): void => {
        listener(isFullScreen);
      };
      ipcRenderer.on('window-state:full-screen-changed', handleChange);
      return () => ipcRenderer.removeListener('window-state:full-screen-changed', handleChange);
    },
  }),
  robotModels: Object.freeze({
    list: () => ipcRenderer.invoke('robot-models:list'),
    chooseDirectory: () => ipcRenderer.invoke('robot-models:choose-directory'),
    resetDirectory: () => ipcRenderer.invoke('robot-models:reset-directory'),
    setForRobot: (robotId: string, id: string | null) => (
      ipcRenderer.invoke('robot-models:set-for-robot', robotId, id)
    ),
    updateOrientation: (id: string, orientation: unknown) => (
      ipcRenderer.invoke('robot-models:update-orientation', id, orientation)
    ),
    urlFor: (id: string, revision: string) => (
      `knightsim-model://robot/${encodeURIComponent(id)}.glb?v=${encodeURIComponent(revision)}`
    ),
  }),
});

export {};
