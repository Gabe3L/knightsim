import type { RobotId } from '../types';
import { telemetryAt } from './mockReplay';

export const GRAPH_SIGNAL_DRAG_TYPE = 'application/x-knightsim-graph-signal';

export type GraphColorCategory = 'mint' | 'blue' | 'violet' | 'amber' | 'coral' | 'rose';

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
  { id: 'mint', label: 'Mint', color: '#62e7bc' },
  { id: 'blue', label: 'Blue', color: '#52a7ff' },
  { id: 'violet', label: 'Violet', color: '#a98cff' },
  { id: 'amber', label: 'Amber', color: '#f1c75b' },
  { id: 'coral', label: 'Coral', color: '#f48a68' },
  { id: 'rose', label: 'Rose', color: '#e96d99' },
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

const fixed = (value: number): ((timeS: number) => number) => () => value;
const number = (value: number, digits: number, unit: string): string => (
  `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}`
);

const signal = (
  descriptor: Omit<GraphSignalDescriptor, 'format'> & { readonly digits?: number },
): GraphSignalDescriptor => ({
  ...descriptor,
  format: (value) => number(value, descriptor.digits ?? 1, descriptor.unit),
});

export const GRAPH_SIGNALS: readonly GraphSignalDescriptor[] = [
  signal({ id: 'sentry.pose.x', robotId: 'sentry', robotName: 'Sentry', topic: 'Pose', label: 'X', unit: 'm', color: '#f0b35a', digits: 3, sampleAt: fixed(2.184) }),
  signal({ id: 'sentry.pose.y', robotId: 'sentry', robotName: 'Sentry', topic: 'Pose', label: 'Y', unit: 'm', color: '#ed8f55', digits: 3, sampleAt: fixed(6.932) }),
  signal({ id: 'sentry.pose.z', robotId: 'sentry', robotName: 'Sentry', topic: 'Pose', label: 'Z', unit: 'm', color: '#da6e64', digits: 3, sampleAt: fixed(0) }),
  signal({ id: 'sentry.pose.yaw', robotId: 'sentry', robotName: 'Sentry', topic: 'Pose', label: 'Yaw', unit: '°', color: '#d59a5f', sampleAt: fixed(-90) }),
  signal({ id: 'sentry.pose.pitch', robotId: 'sentry', robotName: 'Sentry', topic: 'Pose', label: 'Pitch', unit: '°', color: '#c67d67', sampleAt: fixed(0) }),
  signal({ id: 'sentry.pose.roll', robotId: 'sentry', robotName: 'Sentry', topic: 'Pose', label: 'Roll', unit: '°', color: '#b96c73', sampleAt: fixed(0) }),
  signal({ id: 'sentry.referee.hp', robotId: 'sentry', robotName: 'Sentry', topic: 'Referee state', label: 'Hit points', unit: 'HP', color: '#f2c55e', digits: 0, sampleAt: fixed(600) }),
  signal({ id: 'sentry.referee.heat', robotId: 'sentry', robotName: 'Sentry', topic: 'Referee state', label: 'Barrel heat', unit: 'heat', color: '#e27b54', digits: 0, sampleAt: fixed(0) }),

  signal({ id: 'infantry.pose.x', robotId: 'infantry', robotName: 'Infantry', topic: 'Pose', label: 'X', unit: 'm', color: '#58e0b5', digits: 3, sampleAt: (timeS) => telemetryAt(timeS).xM }),
  signal({ id: 'infantry.pose.y', robotId: 'infantry', robotName: 'Infantry', topic: 'Pose', label: 'Y', unit: 'm', color: '#52a7ff', digits: 3, sampleAt: (timeS) => telemetryAt(timeS).yM }),
  signal({ id: 'infantry.pose.z', robotId: 'infantry', robotName: 'Infantry', topic: 'Pose', label: 'Z', unit: 'm', color: '#9e86ff', digits: 3, sampleAt: fixed(0) }),
  signal({ id: 'infantry.pose.yaw', robotId: 'infantry', robotName: 'Infantry', topic: 'Pose', label: 'Yaw', unit: '°', color: '#f1c75b', sampleAt: (timeS) => telemetryAt(timeS).yawDeg }),
  signal({ id: 'infantry.pose.pitch', robotId: 'infantry', robotName: 'Infantry', topic: 'Pose', label: 'Pitch', unit: '°', color: '#f48a68', sampleAt: (timeS) => -1.4 + Math.sin(timeS / 7) * 0.7 }),
  signal({ id: 'infantry.pose.roll', robotId: 'infantry', robotName: 'Infantry', topic: 'Pose', label: 'Roll', unit: '°', color: '#e96d99', sampleAt: (timeS) => 0.2 + Math.sin(timeS / 3.6) * 0.35 }),
  signal({ id: 'infantry.referee.hp', robotId: 'infantry', robotName: 'Infantry', topic: 'Referee state', label: 'Hit points', unit: 'HP', color: '#65df7a', digits: 0, sampleAt: (timeS) => telemetryAt(timeS).hp }),
  signal({ id: 'infantry.referee.heat', robotId: 'infantry', robotName: 'Infantry', topic: 'Referee state', label: 'Barrel heat', unit: 'heat', color: '#ff755f', digits: 0, sampleAt: (timeS) => telemetryAt(timeS).heat }),
  signal({ id: 'infantry.systems.battery', robotId: 'infantry', robotName: 'Infantry', topic: 'Systems', label: 'Battery', unit: 'V', color: '#f2d369', sampleAt: (timeS) => 24.1 - timeS * 0.004 + Math.sin(timeS / 5) * 0.08 }),
  signal({ id: 'infantry.systems.signal', robotId: 'infantry', robotName: 'Infantry', topic: 'Systems', label: 'Signal', unit: 'dBm', color: '#67c7f2', digits: 0, sampleAt: (timeS) => -47 + Math.sin(timeS / 4.7) * 5 }),
  signal({ id: 'infantry.systems.cpu', robotId: 'infantry', robotName: 'Infantry', topic: 'Systems', label: 'CPU load', unit: '%', color: '#a992ff', digits: 0, sampleAt: (timeS) => 38 + Math.sin(timeS / 5.4) * 8 + Math.sin(timeS / 1.8) * 2 }),
  signal({ id: 'infantry.aim.yaw-error', robotId: 'infantry', robotName: 'Infantry', topic: 'Aim', label: 'Yaw error', unit: '°', color: '#eab75f', sampleAt: (timeS) => Math.sin(timeS / 2.8) * 1.3 }),
  signal({ id: 'infantry.aim.pitch-error', robotId: 'infantry', robotName: 'Infantry', topic: 'Aim', label: 'Pitch error', unit: '°', color: '#ed7d88', sampleAt: (timeS) => Math.cos(timeS / 3.4) * 0.65 }),

  signal({ id: 'hero.pose.x', robotId: 'hero', robotName: 'Hero', topic: 'Pose', label: 'X', unit: 'm', color: '#bf81f2', digits: 3, sampleAt: fixed(8.642) }),
  signal({ id: 'hero.pose.y', robotId: 'hero', robotName: 'Hero', topic: 'Pose', label: 'Y', unit: 'm', color: '#9881f5', digits: 3, sampleAt: fixed(1.207) }),
  signal({ id: 'hero.pose.z', robotId: 'hero', robotName: 'Hero', topic: 'Pose', label: 'Z', unit: 'm', color: '#768af0', digits: 3, sampleAt: fixed(0) }),
  signal({ id: 'hero.pose.yaw', robotId: 'hero', robotName: 'Hero', topic: 'Pose', label: 'Yaw', unit: '°', color: '#d98bdc', sampleAt: fixed(176.4) }),
  signal({ id: 'hero.pose.pitch', robotId: 'hero', robotName: 'Hero', topic: 'Pose', label: 'Pitch', unit: '°', color: '#c879cc', sampleAt: fixed(0) }),
  signal({ id: 'hero.pose.roll', robotId: 'hero', robotName: 'Hero', topic: 'Pose', label: 'Roll', unit: '°', color: '#b969bd', sampleAt: fixed(-0.1) }),
  signal({ id: 'hero.referee.hp', robotId: 'hero', robotName: 'Hero', topic: 'Referee state', label: 'Hit points', unit: 'HP', color: '#b98fe9', digits: 0, sampleAt: fixed(300) }),
  signal({ id: 'hero.referee.heat', robotId: 'hero', robotName: 'Hero', topic: 'Referee state', label: 'Barrel heat', unit: 'heat', color: '#e277a6', digits: 0, sampleAt: fixed(18) }),
];

const signalById = new Map(GRAPH_SIGNALS.map((descriptor) => [descriptor.id, descriptor]));

export const graphSignalById = (id: string): GraphSignalDescriptor | null => signalById.get(id) ?? null;

export const graphSignalValueAt = (id: string, timeS: number): number | null => {
  const descriptor = graphSignalById(id);
  if (!descriptor) return null;
  const value = descriptor.sampleAt(timeS);
  return Number.isFinite(value) ? value : null;
};
