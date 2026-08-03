export type Team = 'red' | 'blue' | 'neutral';

export interface Point2M {
  readonly xM: number;
  readonly yM: number;
}

export interface RectM extends Point2M {
  readonly widthM: number;
  readonly depthM: number;
}

export interface FieldZone extends RectM {
  readonly id: string;
  readonly kind: 'starting-resupply' | 'capture' | 'rfid';
  readonly team: Team;
  readonly label: string;
}

export interface FieldBarrier {
  readonly id: string;
  readonly team: Team;
  readonly start: Point2M;
  readonly end: Point2M;
  readonly heightM: number;
}

export interface VisualMarker extends Point2M {
  readonly id: number;
  readonly zM: number;
  readonly facingDeg: number;
  readonly sideM: number;
}

export interface RoadTile extends RectM {
  readonly id: string;
  readonly rotationDeg: 0 | 90;
}

export interface HighGroundSpec {
  readonly footprint: readonly Point2M[];
  readonly approachRunM: number;
  readonly lowerHeightM: number;
  readonly upperHeightM: number;
  readonly inclineDeg: number;
  readonly lowerDecks: readonly RectM[];
  readonly upperDeck: RectM;
}

export interface FieldSpec {
  readonly id: 'arcc-2026-3v3';
  readonly name: string;
  readonly units: 'metres';
  readonly size: { readonly lengthM: number; readonly widthM: number };
  readonly wall: { readonly heightM: number };
  readonly zones: readonly FieldZone[];
  readonly barriers: readonly FieldBarrier[];
  readonly highGround: HighGroundSpec;
  readonly bumpyRoad: {
    readonly tileSizeM: number;
    readonly bumpHeightM: number;
    readonly tiles: readonly RoadTile[];
  };
  readonly rfidPattern: {
    readonly cardWidthM: number;
    readonly cardDepthM: number;
    readonly horizontalGapM: number;
    readonly verticalGapM: number;
  };
  readonly markers: readonly VisualMarker[];
  readonly provenance: readonly string[];
}

const mm = (value: number): number => value / 1000;

const makeRoad = (team: 'red' | 'blue'): RoadTile[] => {
  // Figure 3-9 specifies 400 mm tiles in five 400 mm rows. The stepped
  // 10/10/11/11/12 outline is transcribed directly from the drawing.
  const rowCounts = [10, 10, 11, 11, 12] as const;
  const tileM = mm(400);
  const insideEdgeM = mm(4999);
  const outerStartM = insideEdgeM - rowCounts.at(-1)! * tileM;

  return rowCounts.flatMap((count, row) =>
    Array.from({ length: count }, (_, column) => {
      const leftX = outerStartM + column * tileM;
      const mirroredX = 12 - leftX - tileM;
      return {
        id: `${team}-road-${row}-${column}`,
        xM: team === 'red' ? leftX : mirroredX,
        yM: mm(250) + row * tileM,
        widthM: tileM,
        depthM: tileM,
        rotationDeg: (row + column) % 2 === 0 ? 0 : 90,
      } satisfies RoadTile;
    }),
  );
};

const lowerBarrierHeightM = mm(987);

/**
 * ARCC 2026 3v3 battlefield, transcribed from manual Figures 3-1–3-10.
 * Coordinates use the lower-left inner field corner as (0, 0), +x toward
 * blue, and +y toward the high-ground long wall. Values are stored in metres.
 */
export const ARCC_2026_FIELD = {
  id: 'arcc-2026-3v3',
  name: 'ARCC 2026 · 3v3 Battlefield',
  units: 'metres',
  size: { lengthM: 12, widthM: 8 },
  wall: { heightM: mm(420) },
  zones: [
    {
      id: 'red-resupply',
      kind: 'starting-resupply',
      team: 'red',
      label: 'Red resupply',
      xM: 0,
      yM: mm(2666),
      widthM: 1.5,
      depthM: 2,
    },
    {
      id: 'blue-resupply',
      kind: 'starting-resupply',
      team: 'blue',
      label: 'Blue resupply',
      xM: 10.5,
      yM: mm(2666),
      widthM: 1.5,
      depthM: 2,
    },
    {
      id: 'capture-point',
      kind: 'capture',
      team: 'neutral',
      label: 'Capture point',
      xM: 5,
      yM: 3,
      widthM: 2,
      depthM: 2,
    },
  ],
  // Barrier centre-lines follow the dimensioned/coordinate callouts in
  // Figures 3-3 and 3-10; the team pair is mirrored about x = 6 m.
  barriers: [
    {
      id: 'red-south-barrier',
      team: 'red',
      start: { xM: 2.25, yM: mm(1701) },
      end: { xM: 2.25, yM: mm(3679) },
      heightM: lowerBarrierHeightM,
    },
    {
      id: 'red-north-barrier',
      team: 'red',
      start: { xM: 3.25, yM: mm(6983.9) - mm(2025.4) },
      end: { xM: 3.25, yM: mm(6983.9) },
      heightM: lowerBarrierHeightM,
    },
    {
      id: 'blue-south-barrier',
      team: 'blue',
      start: { xM: 9.75, yM: mm(1701) },
      end: { xM: 9.75, yM: mm(3679) },
      heightM: lowerBarrierHeightM,
    },
    {
      id: 'blue-north-barrier',
      team: 'blue',
      start: { xM: 8.75, yM: mm(6983.9) - mm(2025.4) },
      end: { xM: 8.75, yM: mm(6983.9) },
      heightM: lowerBarrierHeightM,
    },
  ],
  highGround: {
    // 2.2163 m edge location, two 1 m rows, 6 m deck, 784 mm approaches.
    footprint: [
      { xM: mm(2216.3), yM: 8 },
      { xM: 12 - mm(2216.3), yM: 8 },
      { xM: 12 - mm(2216.3), yM: 6 },
      { xM: 7, yM: 6 },
      { xM: 7, yM: 7 },
      { xM: 5, yM: 7 },
      { xM: 5, yM: 6 },
      { xM: mm(2216.3), yM: 6 },
    ],
    approachRunM: mm(784),
    lowerHeightM: mm(210),
    upperHeightM: mm(410),
    inclineDeg: 15,
    lowerDecks: [
      { xM: 3, yM: 7, widthM: 6, depthM: 1 },
      { xM: 3, yM: 6, widthM: 2, depthM: 1 },
      { xM: 7, yM: 6, widthM: 2, depthM: 1 },
    ],
    upperDeck: { xM: 5, yM: 7, widthM: 2, depthM: 1 },
  },
  bumpyRoad: {
    tileSizeM: mm(400),
    bumpHeightM: mm(3.7),
    tiles: [...makeRoad('red'), ...makeRoad('blue')],
  },
  rfidPattern: {
    cardWidthM: mm(92),
    cardDepthM: mm(112),
    horizontalGapM: mm(28),
    verticalGapM: mm(70),
  },
  markers: [
    { id: 0, xM: mm(2428), yM: mm(3679), zM: mm(288), facingDeg: 0, sideM: mm(150) },
    { id: 1, xM: mm(2428), yM: mm(2666), zM: mm(288), facingDeg: 0, sideM: mm(150) },
    { id: 2, xM: mm(4999), yM: mm(1200), zM: mm(288), facingDeg: 90, sideM: mm(150) },
    { id: 3, xM: mm(7001), yM: mm(1200), zM: mm(288), facingDeg: 90, sideM: mm(150) },
    { id: 4, xM: mm(9572), yM: mm(1701), zM: mm(288), facingDeg: 180, sideM: mm(150) },
    { id: 5, xM: mm(9572), yM: mm(3679), zM: mm(288), facingDeg: 180, sideM: mm(150) },
    { id: 6, xM: 11, yM: mm(7999), zM: mm(288), facingDeg: -90, sideM: mm(150) },
    { id: 7, xM: 6, yM: mm(1701), zM: mm(288), facingDeg: 90, sideM: mm(150) },
    { id: 8, xM: 6, yM: mm(6983.9), zM: mm(288), facingDeg: 90, sideM: mm(150) },
    { id: 9, xM: 1, yM: mm(7999), zM: mm(288), facingDeg: -90, sideM: mm(150) },
  ],
  provenance: [
    '2026 ARCC Rules: Events, §3.2.1–3.2.6.2, printed pages 14–20.',
    'Figures 3-1–3-3: overall field, mirrored layout, module placement, heights.',
    'Figures 3-4–3-5: 1500 × 2000 mm starting/resupply zones.',
    'Figures 3-6–3-7: high-ground and 2000 × 2000 mm capture dimensions.',
    'Figures 3-8–3-9: RFID grid and 400 mm bumpy-road tile construction.',
    'Figure 3-10: marker centres and 150 mm marker side length.',
  ],
} as const satisfies FieldSpec;

export const teamColor = (team: Team): string => {
  if (team === 'red') return '#ff4d57';
  if (team === 'blue') return '#3b82f6';
  return '#46e7b2';
};
