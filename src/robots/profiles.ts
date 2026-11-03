import definitions from '../../electron/robotProfiles.json';
import type { RobotCategory, RobotId } from '../types';

export interface RobotProfile {
  readonly id: RobotId;
  readonly name: string;
  readonly category: RobotCategory;
  readonly mobility: 'wheeled' | 'omnidirectional' | 'tracked' | 'legged' | 'aerial';
  readonly dimensionsM: { readonly length: number; readonly width: number; readonly height: number };
  readonly maxHp: number;
  readonly maxHeat: number;
  readonly capabilities: {
    readonly referee: boolean;
    readonly aim: boolean;
    readonly controller: boolean;
    readonly odometry: boolean;
  };
  readonly demoPhase: number;
}

// Shared JSON is also consumed by Electron, so adding a profile does not require
// editing IPC allowlists, model assignments, or individual telemetry views.
export const ROBOT_PROFILES = definitions as readonly RobotProfile[];
const profilesById = new Map(ROBOT_PROFILES.map((profile) => [profile.id, profile]));

export function robotProfile(id: RobotId): RobotProfile {
  const profile = profilesById.get(id);
  if (!profile) throw new Error(`Unknown robot profile: ${id}`);
  return profile;
}
