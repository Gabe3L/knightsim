/// <reference types="vite/client" />

import type { RobotId, RobotModelLibrary, RobotModelOrientation } from './types';
import type { AppUpdateState } from '../electron/updateTypes.cjs';

declare global {
  const __APP_VERSION__: string;
  interface Window {
    readonly knightSim?: {
      readonly platform: string;
      readonly versions: { readonly electron: string };
      readonly updates: {
        readonly getState: () => Promise<AppUpdateState>;
        readonly install: () => Promise<AppUpdateState>;
        readonly onChange: (listener: (state: AppUpdateState) => void) => () => void;
      };
      readonly windowState: {
        readonly isFullScreen: () => Promise<boolean>;
        readonly onFullScreenChange: (listener: (isFullScreen: boolean) => void) => () => void;
      };
      readonly robotModels: {
        readonly list: () => Promise<RobotModelLibrary>;
        readonly chooseDirectory: () => Promise<RobotModelLibrary | null>;
        readonly resetDirectory: () => Promise<RobotModelLibrary>;
        readonly setForRobot: (robotId: RobotId, id: string | null) => Promise<RobotModelLibrary>;
        readonly updateOrientation: (
          id: string,
          orientation: RobotModelOrientation,
        ) => Promise<RobotModelLibrary>;
        readonly urlFor: (id: string, revision: string) => string;
      };
    };
  }
}

export {};
