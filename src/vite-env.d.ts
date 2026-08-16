/// <reference types="vite/client" />

import type { RobotModelLibrary, RobotModelOrientation } from './types';

declare global {
  interface Window {
    readonly knightSim?: {
      readonly platform: string;
      readonly versions: { readonly electron: string };
      readonly robotModels: {
        readonly list: () => Promise<RobotModelLibrary>;
        readonly import: () => Promise<RobotModelLibrary | null>;
        readonly setActive: (id: string | null) => Promise<RobotModelLibrary>;
        readonly updateOrientation: (
          id: string,
          orientation: RobotModelOrientation,
        ) => Promise<RobotModelLibrary>;
        readonly remove: (id: string) => Promise<RobotModelLibrary>;
        readonly urlFor: (id: string) => string;
      };
    };
  }
}

export {};
