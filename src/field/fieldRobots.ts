import { telemetryAt } from '../telemetry/mockReplay';
import type { FieldMode, RobotId, RobotTelemetry } from '../types';

export const FIELD_ROBOT_IDS: Readonly<Record<FieldMode, readonly RobotId[]>> = {
  '1v1': ['infantry'],
  '3v3': ['sentry', 'hero', 'engineer'],
  drone: ['drone'],
};

export function fieldRobotsAt(timeS: number, mode: FieldMode): readonly RobotTelemetry[] {
  return FIELD_ROBOT_IDS[mode].map((id, index) => {
    const robot = telemetryAt(timeS, id);
    // Fit the demo route inside the smaller arena and give the 3v3 units
    // separate lanes so every robot remains visible throughout playback.
    return {
      ...robot,
      xM: mode === '1v1' ? robot.xM * 0.45 : robot.xM,
      yM: mode === '3v3' ? robot.yM + (index - 1) * 1.1 : robot.yM,
    };
  });
}
