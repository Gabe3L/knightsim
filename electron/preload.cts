import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('knightSim', {
  platform: process.platform,
  versions: Object.freeze({ electron: process.versions.electron }),
  robotModels: Object.freeze({
    list: () => ipcRenderer.invoke('robot-models:list'),
    import: (robotId: string) => ipcRenderer.invoke('robot-models:import', robotId),
    setForRobot: (robotId: string, id: string | null) => (
      ipcRenderer.invoke('robot-models:set-for-robot', robotId, id)
    ),
    updateOrientation: (id: string, orientation: unknown) => (
      ipcRenderer.invoke('robot-models:update-orientation', id, orientation)
    ),
    remove: (id: string) => ipcRenderer.invoke('robot-models:remove', id),
    urlFor: (id: string) => `knightsim-model://robot/${encodeURIComponent(id)}.glb`,
  }),
});

export {};
