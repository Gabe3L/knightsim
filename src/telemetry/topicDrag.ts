export const TELEMETRY_TOPIC_DRAG_TYPE = 'application/x-knightsim-telemetry-topic';

// Keep these destination markers aligned with the field-level drag types. This
// module intentionally has no imports so its payload parsing stays portable.
const CONTROLLER_INPUT_DESTINATION_TYPE = 'application/x-knightsim-controller-input';
const FIELD_OVERLAY_DESTINATION_TYPE = 'application/x-knightsim-field-overlay';
const GRAPH_SIGNAL_DESTINATION_TYPE = 'application/x-knightsim-graph-signal';

export interface TelemetryTopicDragPayload {
  readonly controllerInputIds: readonly string[];
  readonly fieldOverlayIds: readonly string[];
  readonly graphSignalIds: readonly string[];
}

interface DragDataReader {
  readonly getData: (format: string) => string;
}

interface DragDataWriter {
  readonly setData: (format: string, data: string) => void;
}

const unique = (ids: readonly string[]): readonly string[] => Array.from(new Set(ids));

export function createTelemetryTopicDragPayload(
  fields: readonly {
    readonly controllerInputId?: string;
    readonly fieldOverlayId?: string;
    readonly graphSignalId?: string;
  }[],
): TelemetryTopicDragPayload {
  return {
    controllerInputIds: unique(fields.flatMap((field) => field.controllerInputId ? [field.controllerInputId] : [])),
    fieldOverlayIds: unique(fields.flatMap((field) => field.fieldOverlayId ? [field.fieldOverlayId] : [])),
    graphSignalIds: unique(fields.flatMap((field) => field.graphSignalId ? [field.graphSignalId] : [])),
  };
}

export function hasTelemetryTopicDragData(payload: TelemetryTopicDragPayload): boolean {
  return payload.controllerInputIds.length > 0
    || payload.fieldOverlayIds.length > 0
    || payload.graphSignalIds.length > 0;
}

export function writeTelemetryTopicDrag(
  dataTransfer: DragDataWriter,
  payload: TelemetryTopicDragPayload,
  label: string,
): void {
  dataTransfer.setData(TELEMETRY_TOPIC_DRAG_TYPE, JSON.stringify(payload));
  dataTransfer.setData('text/plain', label);

  // These entries are both compatibility markers during drag-over and a
  // single-item fallback for any older drop target that does not understand
  // the grouped topic payload yet.
  if (payload.controllerInputIds[0]) {
    dataTransfer.setData(CONTROLLER_INPUT_DESTINATION_TYPE, payload.controllerInputIds[0]);
  }
  if (payload.fieldOverlayIds[0]) {
    dataTransfer.setData(FIELD_OVERLAY_DESTINATION_TYPE, payload.fieldOverlayIds[0]);
  }
  if (payload.graphSignalIds[0]) {
    dataTransfer.setData(GRAPH_SIGNAL_DESTINATION_TYPE, payload.graphSignalIds[0]);
  }
}

const stringArray = (value: unknown): readonly string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

export function readTelemetryTopicDrag(
  dataTransfer: DragDataReader,
): TelemetryTopicDragPayload | null {
  const serialized = dataTransfer.getData(TELEMETRY_TOPIC_DRAG_TYPE);
  if (!serialized) return null;

  try {
    const value = JSON.parse(serialized) as Record<string, unknown>;
    const payload: TelemetryTopicDragPayload = {
      controllerInputIds: unique(stringArray(value.controllerInputIds).filter(Boolean)),
      fieldOverlayIds: unique(stringArray(value.fieldOverlayIds).filter(Boolean)),
      graphSignalIds: unique(stringArray(value.graphSignalIds).filter(Boolean)),
    };
    return hasTelemetryTopicDragData(payload) ? payload : null;
  } catch {
    return null;
  }
}
