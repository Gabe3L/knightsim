export const FIELD_OVERLAY_STORAGE_KEY = 'knightsim:field-overlay-workspace:v2';

export type FieldOverlayKind = 'april-tag' | 'lidar' | 'imu' | 'fused';
export type MeasurementStatus = 'accepted' | 'rejected' | 'predicted' | 'reference';

export interface OverlayPose {
  readonly xM: number;
  readonly yM: number;
  readonly yawDeg: number;
}

export interface OverlayCovariance {
  readonly majorM: number;
  readonly minorM: number;
  readonly angleDeg: number;
}

export interface FieldOverlaySourceDescriptor {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly kind: FieldOverlayKind;
  readonly defaultColor: string;
  readonly tagId?: number;
}

export interface FieldOverlaySample {
  readonly id: string;
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly pose?: OverlayPose;
  readonly path?: readonly OverlayPose[];
  readonly covariance?: OverlayCovariance;
  readonly status?: MeasurementStatus;
  readonly residualToFused?: OverlayPose;
}

export interface FieldOverlayConfig {
  readonly id: string;
  readonly visible: boolean;
  readonly color: string;
}

export interface ResolvedFieldOverlay extends FieldOverlayConfig {
  readonly descriptor: FieldOverlaySourceDescriptor;
  readonly sample: FieldOverlaySample;
}

export interface FieldOverlayWorkspaceState {
  readonly version: 2;
  readonly items: readonly FieldOverlayConfig[];
}

export type FieldOverlayWorkspaceAction = { readonly type: 'toggle-visibility'; readonly id: string };

export const FIELD_OVERLAY_SOURCES: readonly FieldOverlaySourceDescriptor[] = [
  {
    id: 'infantry.odometry.apriltag.7',
    name: 'AprilTag 7 pose',
    source: 'Vision · AprilTag',
    kind: 'april-tag',
    tagId: 7,
    defaultColor: '#f6b84b',
  },
  {
    id: 'infantry.odometry.apriltag.12',
    name: 'AprilTag 12 pose',
    source: 'Vision · AprilTag',
    kind: 'april-tag',
    tagId: 12,
    defaultColor: '#f47a58',
  },
  {
    id: 'infantry.odometry.lidar',
    name: 'LiDAR scan match',
    source: 'LiDAR · Localization',
    kind: 'lidar',
    defaultColor: '#4fb7f3',
  },
  {
    id: 'infantry.odometry.imu',
    name: 'IMU prediction',
    source: 'IMU · Motion model',
    kind: 'imu',
    defaultColor: '#c5c8d0',
  },
  {
    id: 'infantry.odometry.fused',
    name: 'Final fused pose',
    source: 'Odometry · Fused',
    kind: 'fused',
    defaultColor: '#ef4764',
  }
];

const sourceById = new Map(FIELD_OVERLAY_SOURCES.map((source) => [source.id, source]));

export const fieldOverlaySourceById = (id: string): FieldOverlaySourceDescriptor | null => (
  sourceById.get(id) ?? null
);

export const defaultFieldOverlayWorkspaceState = (): FieldOverlayWorkspaceState => ({
  version: 2,
  items: FIELD_OVERLAY_SOURCES.map((source) => ({
    id: source.id,
    visible: true,
    color: source.defaultColor,
  })),
});

export function fieldOverlayWorkspaceReducer(
  state: FieldOverlayWorkspaceState,
  action: FieldOverlayWorkspaceAction,
): FieldOverlayWorkspaceState {
  switch (action.type) {
    case 'toggle-visibility':
      return {
        ...state,
        items: state.items.map((item) => (
          item.id === action.id ? { ...item, visible: !item.visible } : item
        )),
      };
  }
}

function validStoredItem(value: unknown): FieldOverlayConfig | null {
  if (typeof value !== 'object' || value === null) return null;
  const item = value as Partial<FieldOverlayConfig>;
  const source = typeof item.id === 'string' ? fieldOverlaySourceById(item.id) : null;
  if (!source) return null;
  return {
    id: source.id,
    visible: typeof item.visible === 'boolean' ? item.visible : true,
    color: typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color)
      ? item.color
      : source.defaultColor,
  };
}

export function parseFieldOverlayWorkspace(value: unknown): FieldOverlayWorkspaceState {
  const defaults = defaultFieldOverlayWorkspaceState();
  if (typeof value !== 'object' || value === null) return defaults;
  const stored = value as Partial<FieldOverlayWorkspaceState>;
  const storedItems = Array.isArray(stored.items)
    ? stored.items
      .map(validStoredItem)
      .filter((item): item is FieldOverlayConfig => Boolean(item))
    : [];
  const storedItemById = new Map(storedItems.map((item) => [item.id, item]));
  return {
    version: 2,
    items: defaults.items.map((item) => storedItemById.get(item.id) ?? item),
  };
}

export function resolveFieldOverlays(
  items: readonly FieldOverlayConfig[],
  samples: readonly FieldOverlaySample[],
): readonly ResolvedFieldOverlay[] {
  const sampleById = new Map(samples.map((sample) => [sample.id, sample]));
  return items.flatMap((item) => {
    const descriptor = fieldOverlaySourceById(item.id);
    if (!descriptor) return [];
    return [{
      ...item,
      descriptor,
      sample: sampleById.get(item.id) ?? {
        id: item.id,
        available: false,
        unavailableReason: 'Waiting for source data',
      },
    }];
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as {
    readonly tagName?: string;
    readonly isContentEditable?: boolean;
    readonly closest?: (selector: string) => unknown;
  };
  if (element.isContentEditable) return true;
  if (element.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName.toUpperCase())) return true;
  return Boolean(element.closest?.('[contenteditable="true"], [role="textbox"]'));
}

export function isLeftSidebarShortcut(event: Pick<
  KeyboardEvent,
  'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'repeat' | 'target'
>, platform: string = 'win32'): boolean {
  const primaryModifierPressed = platform === 'darwin' ? event.metaKey : event.ctrlKey;
  const otherPrimaryModifierPressed = platform === 'darwin' ? event.ctrlKey : event.metaKey;
  return primaryModifierPressed
    && !event.altKey
    && !otherPrimaryModifierPressed
    && event.code === 'KeyB'
    && !event.repeat
    && !isEditableTarget(event.target);
}
