import type { RobotCategory } from '../types';

export interface RobotCategoryDescriptor {
  readonly id: RobotCategory;
  readonly label: string;
}

export const ROBOT_CATEGORIES: readonly RobotCategoryDescriptor[] = [
  { id: 'ghost', label: 'Ghost' },
  { id: 'enemy', label: 'Enemy' },
  { id: 'infantry', label: 'Infantry' },
  { id: 'sentry', label: 'Sentry' },
  { id: 'hero', label: 'Hero' },
  { id: 'generic', label: 'General purpose' },
];
