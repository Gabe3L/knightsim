export const FIELD_OVERLAY_DRAG_TYPE = 'application/x-knightsim-field-overlay';
export const FIELD_OVERLAY_STORAGE_KEY = 'knightsim:field-overlay-workspace:v1';

export const COLLAPSED_FIELD_SIDEBAR_WIDTH = 12;
export const DEFAULT_FIELD_SIDEBAR_WIDTH = 286;
export const MIN_FIELD_SIDEBAR_WIDTH = 224;
export const MAX_FIELD_SIDEBAR_WIDTH = 420;

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
  readonly version: 1;
  readonly items: readonly FieldOverlayConfig[];
  readonly sidebarWidth: number;
  readonly expandedSidebarWidth: number;
}

export type FieldOverlayWorkspaceAction =
  | { readonly type: 'add'; readonly id: string }
  | { readonly type: 'remove'; readonly id: string }
  | { readonly type: 'toggle-visibility'; readonly id: string }
  | { readonly type: 'hide-all' }
  | { readonly type: 'clear-all' }
  | { readonly type: 'move'; readonly id: string; readonly direction: -1 | 1 }
  | { readonly type: 'set-sidebar-width'; readonly width: number }
  | { readonly type: 'finish-sidebar-resize' }
  | { readonly type: 'toggle-sidebar' }
  | { readonly type: 'expand-sidebar' };

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
  version: 1,
  items: [],
  sidebarWidth: DEFAULT_FIELD_SIDEBAR_WIDTH,
  expandedSidebarWidth: DEFAULT_FIELD_SIDEBAR_WIDTH,
});

export const isFieldSidebarCollapsed = (width: number): boolean => (
  width < MIN_FIELD_SIDEBAR_WIDTH
);

const clampSidebarWidth = (width: number): number => Math.max(
  COLLAPSED_FIELD_SIDEBAR_WIDTH,
  Math.min(MAX_FIELD_SIDEBAR_WIDTH, width),
);

export function fieldOverlayWorkspaceReducer(
  state: FieldOverlayWorkspaceState,
  action: FieldOverlayWorkspaceAction,
): FieldOverlayWorkspaceState {
  switch (action.type) {
    case 'add': {
      if (state.items.some((item) => item.id === action.id)) return state;
      const source = fieldOverlaySourceById(action.id);
      if (!source) return state;
      return {
        ...state,
        items: [...state.items, { id: source.id, visible: true, color: source.defaultColor }],
      };
    }
    case 'remove':
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case 'toggle-visibility':
      return {
        ...state,
        items: state.items.map((item) => (
          item.id === action.id ? { ...item, visible: !item.visible } : item
        )),
      };
    case 'hide-all':
      return { ...state, items: state.items.map((item) => ({ ...item, visible: false })) };
    case 'clear-all':
      return { ...state, items: [] };
    case 'move': {
      const currentIndex = state.items.findIndex((item) => item.id === action.id);
      const nextIndex = currentIndex + action.direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.items.length) return state;
      const items = [...state.items];
      const [item] = items.splice(currentIndex, 1);
      if (!item) return state;
      items.splice(nextIndex, 0, item);
      return { ...state, items };
    }
    case 'set-sidebar-width':
      return { ...state, sidebarWidth: clampSidebarWidth(action.width) };
    case 'finish-sidebar-resize': {
      if (state.sidebarWidth < MIN_FIELD_SIDEBAR_WIDTH) {
        return { ...state, sidebarWidth: COLLAPSED_FIELD_SIDEBAR_WIDTH };
      }
      return {
        ...state,
        expandedSidebarWidth: state.sidebarWidth,
      };
    }
    case 'toggle-sidebar':
      return isFieldSidebarCollapsed(state.sidebarWidth)
        ? { ...state, sidebarWidth: state.expandedSidebarWidth }
        : { ...state, sidebarWidth: COLLAPSED_FIELD_SIDEBAR_WIDTH, expandedSidebarWidth: state.sidebarWidth };
    case 'expand-sidebar':
      return isFieldSidebarCollapsed(state.sidebarWidth)
        ? { ...state, sidebarWidth: state.expandedSidebarWidth }
        : state;
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
  const ids = new Set<string>();
  const items = Array.isArray(stored.items)
    ? stored.items
      .map(validStoredItem)
      .filter((item): item is FieldOverlayConfig => {
        if (!item || ids.has(item.id)) return false;
        ids.add(item.id);
        return true;
      })
    : [];
  const sidebarWidth = typeof stored.sidebarWidth === 'number' && Number.isFinite(stored.sidebarWidth)
    ? clampSidebarWidth(stored.sidebarWidth)
    : defaults.sidebarWidth;
  const expandedSidebarWidth = typeof stored.expandedSidebarWidth === 'number'
    && Number.isFinite(stored.expandedSidebarWidth)
    ? Math.max(MIN_FIELD_SIDEBAR_WIDTH, Math.min(MAX_FIELD_SIDEBAR_WIDTH, stored.expandedSidebarWidth))
    : defaults.expandedSidebarWidth;
  return { version: 1, items, sidebarWidth, expandedSidebarWidth };
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

interface DragDataReader {
  readonly getData: (format: string) => string;
}

export function readFieldOverlayDragId(dataTransfer: DragDataReader): string | null {
  const id = dataTransfer.getData(FIELD_OVERLAY_DRAG_TYPE);
  return fieldOverlaySourceById(id)?.id ?? null;
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

export function isRightSidebarShortcut(event: Pick<
  KeyboardEvent,
  'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'repeat' | 'target'
>, platform: string = 'win32'): boolean {
  const primaryModifierPressed = platform === 'darwin' ? event.metaKey : event.ctrlKey;
  const otherPrimaryModifierPressed = platform === 'darwin' ? event.ctrlKey : event.metaKey;
  return primaryModifierPressed
    && event.altKey
    && !otherPrimaryModifierPressed
    && event.code === 'KeyB'
    && !event.repeat
    && !isEditableTarget(event.target);
}

// Kept as an alias for persisted tests and integrations from the original
// field-only panel. The shortcut now controls the shared right sidebar.
export const isFieldSidebarShortcut = isRightSidebarShortcut;

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
