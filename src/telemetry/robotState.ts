import { robotProfile } from '../robots/profiles';
import { telemetryAt } from './mockReplay';
import type { RobotId, RobotTelemetry } from '../types';

export function robotStateAt(timeS: number, robotId: RobotId, demoEnabled: boolean): RobotTelemetry {
  if (demoEnabled) return telemetryAt(timeS, robotId);

  // No live telemetry source is connected yet. Saved connection preferences
  // alone must never make a robot appear online or supply synthetic readings.
  const profile = robotProfile(robotId);
  return {
    robotId,
    category: profile.category,
    connected: false,
    xM: 0, yM: 0, zM: 0,
    yawDeg: 0, pitchDeg: 0, rollDeg: 0,
    hp: 0, maxHp: profile.maxHp,
    heat: 0, maxHeat: profile.maxHeat,
  };
}
