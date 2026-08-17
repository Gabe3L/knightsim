import type { RobotCategory } from '../types';

export interface RobotCategoryDescriptor {
  readonly id: RobotCategory;
  readonly label: string;
}

export interface RobotRenderProfile {
  readonly body: string;
  readonly bodyStroke: string;
  readonly halo: string;
  readonly haloStroke: string;
  readonly emissive: string;
}

export const ROBOT_CATEGORIES: readonly RobotCategoryDescriptor[] = [
  { id: 'ghost', label: 'Ghost' },
  { id: 'enemy', label: 'Enemy' },
  { id: 'infantry', label: 'Infantry' },
  { id: 'sentry', label: 'Sentry' },
  { id: 'hero', label: 'Hero' },
];

// Every category deliberately shares a profile for now. Renderers still resolve
// through this map so category-specific glyphs or materials can be added later
// without changing the telemetry or sidebar data structures.
const sharedProfile: RobotRenderProfile = {
  body: '#df3341',
  bodyStroke: '#ff9299',
  halo: '#ff4655',
  haloStroke: '#ff5b66',
  emissive: '#ff4655',
};

export const ROBOT_RENDER_PROFILES: Readonly<Record<RobotCategory, RobotRenderProfile>> = {
  ghost: sharedProfile,
  enemy: sharedProfile,
  infantry: sharedProfile,
  sentry: sharedProfile,
  hero: sharedProfile,
};

export const robotRenderProfile = (category: RobotCategory): RobotRenderProfile => (
  ROBOT_RENDER_PROFILES[category]
);
