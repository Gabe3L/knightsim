export type ViewMode = '2d' | '3d' | 'graph' | 'controller';

export type RobotId = 'sentry' | 'infantry' | 'hero';

export type RobotCategory = 'ghost' | 'enemy' | 'infantry' | 'sentry' | 'hero';

export type ModelAxis = 'x' | 'y' | 'z';

export interface RobotModelOrientation {
  readonly rotationDeg: Record<ModelAxis, number>;
  readonly flipped: Record<ModelAxis, boolean>;
}

export interface RobotModelRecord {
  readonly id: string;
  readonly name: string;
  readonly sourceFileName: string;
  readonly sizeBytes: number;
  readonly importedAt: string;
  readonly orientation: RobotModelOrientation;
}

export interface RobotModelLibrary {
  readonly version: 2;
  readonly modelIdByRobot: Readonly<Record<RobotId, string | null>>;
  readonly models: readonly RobotModelRecord[];
}

export interface RobotPose {
  readonly xM: number;
  readonly yM: number;
  readonly yawDeg: number;
}

export interface RobotTelemetry extends RobotPose {
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
  readonly followRobot: boolean;
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
