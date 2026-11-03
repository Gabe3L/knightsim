export type ViewMode = 'field' | 'graph' | 'controller';

export type FieldMode = '1v1' | 'sentry' | '3v3' | 'drone' | 'dart';

export type ControllerMode = 'kbm' | 'xbox' | 'ps5' | 'dji';

/** Stable profile/instance identifier, independent of category or chassis. */
export type RobotId = string;

export type RobotCategory = 'ghost' | 'enemy' | 'infantry' | 'sentry' | 'hero' | 'generic';

export type ModelAxis = 'x' | 'y' | 'z';

// Keep the renderer and Electron IPC persistence contract in sync.
export type { RobotModelOrientation, RobotModelRecord, RobotModelLibrary } from '../electron/modelLibrary.cjs';

export interface RobotPose {
  readonly xM: number;
  readonly yM: number;
  readonly yawDeg: number;
}

export interface RobotTelemetry extends RobotPose {
  readonly zM: number;
  readonly pitchDeg: number;
  readonly rollDeg: number;
  readonly robotId: RobotId;
  readonly category: RobotCategory;
  readonly hp: number;
  readonly maxHp: number;
  readonly heat: number;
  readonly maxHeat: number;
  readonly connected: boolean;
}

export interface CameraState {
  readonly targetXM: number;
  readonly targetYM: number;
  readonly zoom: number;
}

export interface ReplayFrame {
  readonly timeS: number;
  readonly robot: RobotTelemetry;
}

export interface ReplayState {
  readonly durationS: number;
  readonly currentTimeS: number;
  readonly playing: boolean;
  readonly speed: number;
}
