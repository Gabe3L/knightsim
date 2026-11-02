import { REPLAY_DURATION_S, telemetryAt } from '../telemetry/mockReplay';
import type { FieldMode, RobotId, RobotTelemetry } from '../types';

export const FIELD_ROBOT_IDS: Readonly<Record<FieldMode, readonly RobotId[]>> = {
  '1v1': ['infantry'], sentry: ['sentry'], '3v3': ['sentry', 'hero', 'engineer'], drone: ['drone'],
};

type Waypoint = readonly [timeS: number, xM: number, yM: number, zM: number];
// Synthetic preview routes run through open corridors of the Season 2 fields.
// Ground robots intentionally stay off platforms; this is not a physics solver.
const routes: Readonly<Record<string, readonly Waypoint[]>> = {
  infantry: [[0, 0.65, 4.35, 0], [20, 1.1, 3.4, 0], [40, 2.7, 3.6, 0], [60, 4.35, 3.5, 0], [84, 4.35, 0.65, 0]],
  sentry: [[0, 0.8, 2.7, 0], [16, 1.2, 3.4, 0], [20, 1.6, 3.45, 0], [45, 4.8, 3.45, 0], [84, 3.7, 3.45, 0]],
  hero: [[0, 3.8, 1.7, 0], [42, 8.1, 1.7, 0], [84, 4, 1.7, 0]],
  engineer: [[0, 6.9, 5.2, 0], [42, 10.7, 5.2, 0], [84, 6.9, 5.2, 0]],
  drone: [[0, 25, 6, 0], [6, 25, 6, 1.5], [28, 12, 3, 1.7], [44, 4, 1.5, 1.5],
    [70, 25, 6, 1.5], [84, 25, 6, 0]],
};

export function fieldRobotsAt(timeS: number, mode: FieldMode): readonly RobotTelemetry[] {
  const time = Math.max(0, Math.min(REPLAY_DURATION_S, Number.isFinite(timeS) ? timeS : 0));
  return FIELD_ROBOT_IDS[mode].map((id) => {
    const route = routes[mode === 'sentry' ? 'infantry' : id]!;
    const endIndex = Math.max(1, route.findIndex((point) => point[0] >= time));
    const start = route[endIndex - 1]!, end = route[endIndex]!;
    const t = (time - start[0]) / (end[0] - start[0]);
    const lerp = (a: number, b: number) => a + (b - a) * t;
    return {
      ...telemetryAt(time, id),
      xM: lerp(start[1], end[1]), yM: lerp(start[2], end[2]), zM: lerp(start[3], end[3]),
      yawDeg: Math.atan2(end[2] - start[2], end[1] - start[1]) * 180 / Math.PI,
    };
  });
}
