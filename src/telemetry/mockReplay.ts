import type { ReplayFrame, RobotTelemetry } from '../types';

export const REPLAY_DURATION_S = 84;

const path = [
  { timeS: 0, xM: 0.82, yM: 3.65, yawDeg: 0 },
  { timeS: 12, xM: 2.05, yM: 3.58, yawDeg: -12 },
  { timeS: 24, xM: 3.72, yM: 3.12, yawDeg: 18 },
  { timeS: 38, xM: 5.15, yM: 3.78, yawDeg: 46 },
  { timeS: 52, xM: 6.38, yM: 4.26, yawDeg: 4 },
  { timeS: 68, xM: 7.86, yM: 3.42, yawDeg: -36 },
  { timeS: 84, xM: 9.08, yM: 3.72, yawDeg: 0 },
] as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const telemetryAt = (timeS: number): RobotTelemetry => {
  const clampedTime = Math.max(0, Math.min(REPLAY_DURATION_S, timeS));
  const rightIndex = path.findIndex((point) => point.timeS >= clampedTime);
  const end = path[Math.max(1, rightIndex === -1 ? path.length - 1 : rightIndex)]!;
  const start = path[Math.max(0, path.indexOf(end) - 1)]!;
  const span = Math.max(0.001, end.timeS - start.timeS);
  const progress = (clampedTime - start.timeS) / span;

  return {
    robotId: 'infantry',
    xM: lerp(start.xM, end.xM, progress),
    yM: lerp(start.yM, end.yM, progress),
    yawDeg: lerp(start.yawDeg, end.yawDeg, progress),
    hp: Math.round(400 - clampedTime * 1.36),
    maxHp: 400,
    heat: Math.round(42 + Math.sin(clampedTime / 4) * 28 + clampedTime * 0.62),
    maxHeat: 260,
    connected: clampedTime < 76 || clampedTime > 78.4,
  };
};

export const mockReplayFrames: readonly ReplayFrame[] = Array.from(
  { length: REPLAY_DURATION_S + 1 },
  (_, timeS) => ({ timeS, robot: telemetryAt(timeS) }),
);
