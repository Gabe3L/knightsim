import { ROBOT_PROFILES } from '../robots/profiles';
import type { RobotId } from '../types';
import { telemetryAt } from './mockReplay';

export const GRAPH_SIGNAL_DRAG_TYPE = 'application/x-knightsim-graph-signal';

export type GraphColorCategory = 'crimson' | 'silver' | 'garnet' | 'platinum' | 'scarlet' | 'steel';

export interface GraphSignalConfig {
  readonly id: string;
  readonly colorCategory: GraphColorCategory;
}

export interface GraphColorCategoryDescriptor {
  readonly id: GraphColorCategory;
  readonly label: string;
  readonly color: string;
}

export const GRAPH_COLOR_CATEGORIES: readonly GraphColorCategoryDescriptor[] = [
  { id: 'crimson', label: 'Crimson', color: '#ef4764' },
  { id: 'silver', label: 'Silver', color: '#c5c8d0' },
  { id: 'garnet', label: 'Garnet', color: '#a92f49' },
  { id: 'platinum', label: 'Platinum', color: '#e1e3e8' },
  { id: 'scarlet', label: 'Scarlet', color: '#ff6b72' },
  { id: 'steel', label: 'Steel', color: '#858b96' },
];

const graphColorByCategory = new Map(GRAPH_COLOR_CATEGORIES.map((category) => [
  category.id,
  category.color,
]));

export const graphColorForCategory = (category: GraphColorCategory): string => (
  graphColorByCategory.get(category) ?? GRAPH_COLOR_CATEGORIES[0]!.color
);

export const defaultGraphColorCategory = (index: number): GraphColorCategory => (
  GRAPH_COLOR_CATEGORIES[index % GRAPH_COLOR_CATEGORIES.length]!.id
);

export interface GraphSignalDescriptor {
  readonly id: string;
  readonly robotId: RobotId;
  readonly robotName: string;
  readonly topic: string;
  readonly label: string;
  readonly unit: string;
  readonly color: string;
  readonly sampleAt: (timeS: number) => number;
  readonly format: (value: number) => string;
}

const number = (value: number, digits: number, unit: string): string => (
  `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}`
);

const signal = (
  descriptor: Omit<GraphSignalDescriptor, 'format'> & { readonly digits?: number },
): GraphSignalDescriptor => ({
  ...descriptor,
  format: (value) => number(value, descriptor.digits ?? 1, descriptor.unit),
});

export const GRAPH_SIGNALS: readonly GraphSignalDescriptor[] = ROBOT_PROFILES.flatMap((profile) => {
  const descriptor = (
    suffix: string, topic: string, label: string, unit: string,
    sampleAt: (timeS: number) => number, digits = 1,
  ) => signal({
    id: `${profile.id}.${suffix}`, robotId: profile.id, robotName: profile.name,
    topic, label, unit, color: '#ef4764', digits, sampleAt,
  });
  const pose = (key: 'xM' | 'yM' | 'zM' | 'yawDeg' | 'pitchDeg' | 'rollDeg') => (
    (timeS: number) => telemetryAt(timeS, profile.id)[key]
  );
  return [
    descriptor('pose.x', 'Pose', 'X', 'm', pose('xM'), 3),
    descriptor('pose.y', 'Pose', 'Y', 'm', pose('yM'), 3),
    descriptor('pose.z', 'Pose', 'Z', 'm', pose('zM'), 3),
    descriptor('pose.yaw', 'Pose', 'Yaw', '°', pose('yawDeg')),
    descriptor('pose.pitch', 'Pose', 'Pitch', '°', pose('pitchDeg')),
    descriptor('pose.roll', 'Pose', 'Roll', '°', pose('rollDeg')),
    ...(profile.capabilities.referee ? [
      descriptor('referee.hp', 'Referee state', 'Hit points', 'HP', (t) => telemetryAt(t, profile.id).hp, 0),
      ...(profile.maxHeat > 0 ? [descriptor('referee.heat', 'Referee state', 'Barrel heat', 'heat', (t) => telemetryAt(t, profile.id).heat, 0)] : []),
    ] : []),
    descriptor('systems.battery', 'Systems', 'Battery', 'V', (t) => 24.1 - t * 0.004 + Math.sin(t / 5) * 0.08),
    descriptor('systems.signal', 'Systems', 'Signal', 'dBm', (t) => -47 + Math.sin(t / 4.7) * 5, 0),
    descriptor('systems.cpu', 'Systems', 'CPU load', '%', (t) => 38 + Math.sin(t / 5.4) * 8, 0),
    ...(profile.capabilities.aim ? [
      descriptor('aim.yaw-error', 'Aim', 'Yaw error', '°', (t) => Math.sin(t / 2.8) * 1.3),
      descriptor('aim.pitch-error', 'Aim', 'Pitch error', '°', (t) => Math.cos(t / 3.4) * 0.65),
    ] : []),
  ];
});

const signalById = new Map(GRAPH_SIGNALS.map((descriptor) => [descriptor.id, descriptor]));

export const graphSignalById = (id: string): GraphSignalDescriptor | null => signalById.get(id) ?? null;

export const graphSignalValueAt = (id: string, timeS: number): number | null => {
  const descriptor = graphSignalById(id);
  if (!descriptor) return null;
  const value = descriptor.sampleAt(timeS);
  return Number.isFinite(value) ? value : null;
};
