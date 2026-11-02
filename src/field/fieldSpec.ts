import type { FieldMode } from '../types';

export type Team = 'red' | 'blue' | 'neutral';
export interface Point2M { readonly xM: number; readonly yM: number }
export interface RectM extends Point2M { readonly widthM: number; readonly depthM: number }
export interface FieldZone extends RectM {
  readonly id: string;
  readonly team: Team;
  readonly tapeWidthM: number;
}
export interface Platform extends RectM { readonly id: string; readonly heightM: number }
export interface RampSpec extends Platform { readonly ascending: boolean }
export interface Barrier extends Platform {
  readonly sheetHeightM?: number;
  readonly sheetLengthM?: number;
}
export interface RoadTile extends RectM { readonly id: string; readonly rotationDeg: 0 | 90 }
export interface LimboBar extends RectM {
  readonly id: string;
  readonly clearanceM: number;
  readonly openingM: number;
  readonly beamWidthM: number;
  readonly beamHeightM: number;
}

const mm = (n: number) => n / 1000;
const tapeWidthM = mm(50.8);
const wall = { heightM: mm(500), thicknessM: mm(170), frameM: mm(19) };
const mirroredRect = <T extends RectM>(rect: T): T => ({ ...rect, xM: 12 - rect.xM - rect.widthM });

function roadPatch(id: string, xM: number, yM: number, columns: number, rows: number): RoadTile[] {
  return Array.from({ length: rows * columns }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return { id: `${id}-${row}-${column}`, xM: xM + column * 0.4, yM: yM + row * 0.4,
      widthM: 0.4, depthM: 0.4, rotationDeg: (row + column) % 2 === 0 ? 0 : 90 };
  });
}
const redRoad = [...roadPatch('red-road-lower', 1.1, 5.2, 4, 2), ...roadPatch('red-road-upper', 1.9, 6, 2, 2)];
const redLower = { id: 'red-side-lower', xM: 2, yM: 2, widthM: 1, depthM: 1, heightM: 0.21 };
const redUpper = { id: 'red-side-upper', xM: 2, yM: 1, widthM: 1, depthM: 1, heightM: 0.41 };
// Figure 3-12: 600 mm of clear floor between the wall end and the near
// face of the 38.1 mm post at the central deck's y = 6 m edge.
const centralWallEndM = 6 - mm(38.1) - mm(600);

/** Season 2, November 1, 2026, Figures 3-1–3-13. Origin is the near-left
 * inner corner, +x toward blue, +y toward the central high ground. */
export const ARCC_2027_3V3_FIELD = {
  id: 'arcc-2027-3v3', name: 'ARCC 2026–2027 · 3v3 Battlefield', units: 'metres',
  size: { lengthM: 12, widthM: 8 },
  floor: { xM: 0, yM: 0, widthM: 12, depthM: 8 }, wall,
  zones: [
    { id: 'red-resupply', team: 'red', xM: 0, yM: 0, widthM: 1.5, depthM: 2, tapeWidthM },
    { id: 'blue-resupply', team: 'blue', xM: 10.5, yM: 0, widthM: 1.5, depthM: 2, tapeWidthM },
  ] satisfies FieldZone[],
  barriers: [
    { id: 'red-side-wall', xM: 0, yM: 3.915, widthM: 2, depthM: 0.17, heightM: 0.422 },
    { id: 'blue-side-wall', xM: 10, yM: 3.915, widthM: 2, depthM: 0.17, heightM: 0.422 },
    { id: 'central-wall', xM: 5.915, yM: centralWallEndM - 3, widthM: 0.17, depthM: 3,
      heightM: 0.422, sheetHeightM: 1.406, sheetLengthM: 2.559 },
  ] satisfies Barrier[],
  centralHighGround: {
    deck: { id: 'central-high-ground', xM: 4.5, yM: 6, widthM: 3, depthM: 2, heightM: 0.21 },
    inclineDeg: 15,
    ramps: [
      { id: 'red-central-ramp', xM: 3.716, yM: 6, widthM: 0.784, depthM: 2, heightM: 0.21, ascending: true },
      { id: 'blue-central-ramp', xM: 7.5, yM: 6, widthM: 0.784, depthM: 2, heightM: 0.21, ascending: false },
    ] satisfies RampSpec[],
  },
  sideHighGrounds: [redLower, redUpper,
    { ...mirroredRect(redLower), id: 'blue-side-lower' }, { ...mirroredRect(redUpper), id: 'blue-side-upper' }],
  scoringAreas: [
    { id: 'red-score', team: 'red', xM: 0.8, yM: 6.85, widthM: 0.3, depthM: 0.3, heightM: 0.05 },
    { id: 'blue-score', team: 'blue', xM: 10.9, yM: 6.85, widthM: 0.3, depthM: 0.3, heightM: 0.05 },
  ],
  scoringTapeWidthM: tapeWidthM,
  pipeChutes: [
    { id: 'red-chute', xM: 0.95, yM: 8, zM: 0.6 },
    { id: 'blue-chute', xM: 11.05, yM: 8, zM: 0.6 },
  ],
  chute: { widthM: 0.2, heightM: 0.2, openingDiameterM: 0.0525 },
  objectives: {
    cube: { xM: 6, yM: 7, zM: 0.21, sideM: 0.1 },
    bucket: { xM: 6, yM: 1, diameterM: 0.2, heightM: 0.25 },
    pipes: { redCount: 5, blueCount: 5, lengthM: 0.5, outerDiameterM: 0.0267 },
    donuts: [ { xM: 2.8, yM: 2.8, zM: 0.21 }, { xM: 9.2, yM: 2.8, zM: 0.21 } ],
    donut: { outerDiameterM: 0.1, innerDiameterM: 0.05, thicknessM: 0.025 },
    pole: { heightM: 0.456, plateSideM: 0.25 },
  },
  bumpyRoad: {
    tileSizeM: 0.4, baseThicknessM: 0.0025, bumpHeightM: 0.0012,
    bumpCount: 4, bumpLengthM: 0.35, bumpWidthM: 0.0538, bumpGapM: 0.045, edgeMarginM: 0.025,
    tiles: [...roadPatch('central-road', 2.8, 3, 16, 4), ...redRoad,
      ...redRoad.map((tile) => ({ ...mirroredRect(tile), id: tile.id.replace('red-', 'blue-') }))],
  },
  limboBars: [
    { id: 'central-limbo', xM: 6 - 0.0889 / 2, yM: centralWallEndM, widthM: 0.0889,
      depthM: 6 - centralWallEndM, clearanceM: 0.42, openingM: 0.6, beamWidthM: 0.0889, beamHeightM: 0.0381 },
    { id: 'red-side-limbo', xM: 2.43, yM: 0, widthM: 0.14, depthM: 1,
      clearanceM: 0.3, openingM: 1, beamWidthM: 0.14, beamHeightM: 0.0381 },
    { id: 'blue-side-limbo', xM: 12 - 2.43 - 0.14, yM: 0, widthM: 0.14, depthM: 1,
      clearanceM: 0.3, openingM: 1, beamWidthM: 0.14, beamHeightM: 0.0381 },
  ] satisfies LimboBar[],
  provenance: ['Events Manual Season 2 V1.0, November 1, 2026, §3.2, pp. 13–24.',
    'Figure 3-3: wall plan; Figure 3-12: central wall endpoint derived from clear opening and post.',
    'Zig-zag pole profile is illustrative: §3.2.4.4 defers additional details. RFID cards are inlaid; no grid is dimensioned.'],
} as const;

// Figure 4-3 dimensions points on the same face of each bunker, not its centre.
// The 600/800 mm endpoint offsets give a 1000 mm run at atan2(800, 600).
const bunkerAngleDeg = Math.atan2(0.8, 0.6) * 180 / Math.PI;
export const ARCC_2027_1V1_FIELD = {
  id: 'arcc-2027-1v1', name: 'ARCC 2026–2027 · 1v1 Battlefield', units: 'metres',
  size: { lengthM: 5, widthM: 5 }, floor: { xM: 0, yM: 0, widthM: 5, depthM: 5 }, wall,
  zones: [
    { id: 'red-start', team: 'red', xM: 0, yM: 4, widthM: 1, depthM: 1, tapeWidthM },
    { id: 'blue-start', team: 'blue', xM: 4, yM: 0, widthM: 1, depthM: 1, tapeWidthM },
  ] satisfies FieldZone[],
  bunkers: [
    { id: 'red-bunker', center: { xM: 1.768, yM: 2.499 }, lengthM: 1, depthM: 0.17, heightM: 0.422, rotationDeg: bunkerAngleDeg },
    { id: 'blue-bunker', center: { xM: 3.232, yM: 2.501 }, lengthM: 1, depthM: 0.17, heightM: 0.422, rotationDeg: bunkerAngleDeg },
  ],
  provenance: ['Events Manual Season 2 V1.0, November 1, 2026, §4.2, pp. 35–38; Figures 4-1–4-4.',
    'Perimeter construction and tape width follow the 3v3 components; not separately dimensioned for 1v1.'],
} as const;

/** Figure 6-2 gives offsets between the base centre and launch-zone centre,
 * not the dimensions of an enclosed arena. The drone field has no walls. */
export const ARCC_2027_DRONE_FIELD = {
  id: 'arcc-2027-drone', name: 'ARCC 2026–2027 · Drone Challenge', units: 'metres',
  size: { lengthM: 25, widthM: 6 },
  floor: { xM: -1.1, yM: -1.1, widthM: 27.2, depthM: 8.2 }, wall: null,
  zones: [{ id: 'drone-start', team: 'red', xM: 23.9, yM: 4.9, widthM: 2.2, depthM: 2.2, tapeWidthM }] satisfies FieldZone[],
  base: {
    xM: 0, yM: 0,
    armorCenterHeightM: 0.461, armorCenterRadiusM: 0.268, armorTiltDeg: 13.9,
    armorAnglesDeg: [180, 60, -60],
    // Shell dimensions, module outline, corner guards, and top hardware are
    // visual estimates from Figures 6-1/6-3; only armor positions are dimensioned.
    visual: { heightM: 0.61, armorWidthM: 0.21, armorHeightM: 0.13, cornerTrim: 0.18 },
  },
  provenance: ['Events Manual Season 2 V1.0, November 1, 2026, §6.2, pp. 42–44; Figures 6-1–6-3.',
    'Launch centre (25, 6) m relative to base centre; 2200 × 2200 mm launch zone.',
    'Floor extent is display padding, not a competition boundary. Base shell and armor outlines are illustrative.'],
} as const;

export const FIELD_SPECS = { '1v1': ARCC_2027_1V1_FIELD, '3v3': ARCC_2027_3V3_FIELD, drone: ARCC_2027_DRONE_FIELD } as const;
export const fieldWorldX = (xM: number, mode: FieldMode): number => FIELD_SPECS[mode].size.lengthM / 2 - xM;
export const fieldWorldZ = (yM: number, mode: FieldMode): number => yM - FIELD_SPECS[mode].size.widthM / 2;
export const teamColor = (team: Team): string => team === 'red' ? '#ed202b' : team === 'blue' ? '#2439e9' : '#e7bd20';

export const fieldCameraDirection = (mode: FieldMode): readonly [number, number, number] =>
  mode === '3v3' ? [3.8, 8.4, -8.8] : [0, 8.4, -8.8];

/** Fit every field corner in the default 43° perspective camera, accounting
 * for its oblique viewing direction and the actual canvas aspect ratio. */
export function fieldCameraDistance(mode: FieldMode, aspect: number): number {
  const spec = FIELD_SPECS[mode];
  const pad = spec.wall ? spec.wall.thicknessM : 0;
  const halfX = spec.floor.widthM / 2 + pad;
  const halfZ = spec.floor.depthM / 2 + pad;
  const height = mode === '3v3' ? 1.406 : mode === 'drone' ? 1.7 : 0.5;
  const vertical = Math.tan(43 * Math.PI / 360);
  const horizontal = vertical * Math.max(0.1, aspect);
  const direction = fieldCameraDirection(mode);
  const norm = Math.hypot(...direction);
  const [cx, cy, cz] = direction.map((value) => value / norm) as [number, number, number];
  const h = Math.hypot(cx, cz);
  let distance = 0;
  for (const x of [-halfX, halfX]) for (const z of [-halfZ, halfZ]) for (const y of [0, height]) {
    const depthOffset = cx * x + cy * y + cz * z;
    const screenX = (-cz * x + cx * z) / h;
    const screenY = -cy * cx * x / h + h * y - cy * cz * z / h;
    distance = Math.max(distance, Math.abs(screenX) / horizontal + depthOffset,
      Math.abs(screenY) / vertical + depthOffset);
  }
  return distance * 1.06;
}
