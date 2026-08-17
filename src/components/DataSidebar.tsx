import {
  ArrowDown,
  ArrowUp,
  Bot,
  Database,
  Eye,
  EyeOff,
  Gamepad2,
  GripVertical,
  Layers3,
  LineChart,
  Trash2,
  X,
} from 'lucide-react';
import {
  useMemo,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  CONTROLLER_INPUT_DRAG_TYPE,
  CONTROLLER_INPUTS,
  controllerInputById,
  readControllerInputDragId,
  type ControllerControl,
  type ControllerInputDescriptor,
} from '../telemetry/controllerInputs';
import {
  GRAPH_COLOR_CATEGORIES,
  GRAPH_SIGNAL_DRAG_TYPE,
  graphColorForCategory,
  graphSignalById,
  type GraphColorCategory,
  type GraphSignalConfig,
  type GraphSignalDescriptor,
} from '../telemetry/graphSignals';
import { ROBOT_CATEGORIES } from '../telemetry/robotCategories';
import { readTelemetryTopicDrag } from '../telemetry/topicDrag';
import {
  FIELD_OVERLAY_DRAG_TYPE,
  fieldOverlaySourceById,
  readFieldOverlayDragId,
  type ResolvedFieldOverlay,
} from '../overlays/fieldOverlays';
import type { RobotCategory, RobotTelemetry, ViewMode } from '../types';

interface DataSidebarProps {
  readonly collapsed: boolean;
  readonly controllerInputIds: readonly string[];
  readonly currentTimeS: number;
  readonly graphSignals: readonly GraphSignalConfig[];
  readonly maxWidth: number;
  readonly minWidth: number;
  readonly overlays: readonly ResolvedFieldOverlay[];
  readonly robot: RobotTelemetry;
  readonly view: ViewMode;
  readonly width: number;
  readonly onAddControllerInput: (id: string) => void;
  readonly onAddGraphSignal: (id: string) => void;
  readonly onAddOverlay: (id: string) => void;
  readonly onClearControllerInputs: () => void;
  readonly onClearGraphSignals: () => void;
  readonly onClearOverlays: () => void;
  readonly onCollapse: () => void;
  readonly onExpand: () => void;
  readonly onHideAllOverlays: () => void;
  readonly onMoveOverlay: (id: string, direction: -1 | 1) => void;
  readonly onRemoveControllerInput: (id: string) => void;
  readonly onRemoveGraphSignal: (id: string) => void;
  readonly onRemoveOverlay: (id: string) => void;
  readonly onResize: (pointerX: number) => void;
  readonly onResizeEnd: () => void;
  readonly onResizeKeyboard: (width: number) => void;
  readonly onResizeStart: (pointerX: number) => void;
  readonly onSetGraphColor: (id: string, color: GraphColorCategory) => void;
  readonly onSetRobotCategory: (category: RobotCategory) => void;
  readonly onToggleOverlayVisibility: (id: string) => void;
}

interface ControllerSlot {
  readonly control: ControllerControl;
  readonly label: string;
  readonly kind: ControllerInputDescriptor['kind'];
}

const CONTROLLER_SLOTS: readonly ControllerSlot[] = CONTROLLER_INPUTS
  .filter((input) => input.robotId === 'infantry')
  .map(({ control, label, kind }) => ({ control, label, kind }));

const fieldOverlayStatus = (overlay: ResolvedFieldOverlay): string => {
  if (!overlay.sample.available) return 'Unavailable';
  const status = overlay.sample.status ?? 'available';
  return status[0]!.toUpperCase() + status.slice(1);
};

const viewLabel = (view: ViewMode): string => {
  switch (view) {
    case 'field': return 'Field data';
    case 'graph': return 'Line graph data';
    case 'controller': return 'Controller data';
  }
};

function DropZoneLabel({ view }: { readonly view: ViewMode }) {
  if (view === 'graph') return <><LineChart size={13} /> Drop numeric signals below</>;
  if (view === 'controller') return <><Gamepad2 size={13} /> Drop input channels into slots</>;
  return <><Layers3 size={13} /> Drop field overlays below</>;
}

export function DataSidebar({
  collapsed,
  controllerInputIds,
  currentTimeS,
  graphSignals,
  maxWidth,
  minWidth,
  overlays,
  robot,
  view,
  width,
  onAddControllerInput,
  onAddGraphSignal,
  onAddOverlay,
  onClearControllerInputs,
  onClearGraphSignals,
  onClearOverlays,
  onCollapse,
  onExpand,
  onHideAllOverlays,
  onMoveOverlay,
  onRemoveControllerInput,
  onRemoveGraphSignal,
  onRemoveOverlay,
  onResize,
  onResizeEnd,
  onResizeKeyboard,
  onResizeStart,
  onSetGraphColor,
  onSetRobotCategory,
  onToggleOverlayVisibility,
}: DataSidebarProps) {
  const [dropActive, setDropActive] = useState(false);
  const fieldView = view === 'field';
  const graphItems = useMemo(() => graphSignals.flatMap((config) => {
    const descriptor = graphSignalById(config.id);
    return descriptor ? [{ config, descriptor }] : [];
  }), [graphSignals]);
  const controllerInputs = useMemo(() => controllerInputIds
    .map(controllerInputById)
    .filter((input): input is ControllerInputDescriptor => Boolean(input)), [controllerInputIds]);
  const controllerInputByControl = useMemo(() => new Map(
    controllerInputs.map((input) => [input.control, input]),
  ), [controllerInputs]);

  const supportsDrag = (event: DragEvent<HTMLElement>): boolean => {
    const types = Array.from(event.dataTransfer.types);
    if (fieldView) return types.includes(FIELD_OVERLAY_DRAG_TYPE);
    if (view === 'graph') return types.includes(GRAPH_SIGNAL_DRAG_TYPE);
    return types.includes(CONTROLLER_INPUT_DRAG_TYPE);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!supportsDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    if (!supportsDrag(event)) return;
    event.preventDefault();
    setDropActive(false);
    const topic = readTelemetryTopicDrag(event.dataTransfer);
    if (fieldView) {
      if (topic) {
        topic.fieldOverlayIds.filter((id) => fieldOverlaySourceById(id) !== null).forEach(onAddOverlay);
        onExpand();
        return;
      }
      const id = readFieldOverlayDragId(event.dataTransfer);
      if (id) onAddOverlay(id);
    } else if (view === 'graph') {
      if (topic) {
        topic.graphSignalIds.filter((id) => graphSignalById(id) !== null).forEach(onAddGraphSignal);
        onExpand();
        return;
      }
      const id = event.dataTransfer.getData(GRAPH_SIGNAL_DRAG_TYPE);
      if (graphSignalById(id)) onAddGraphSignal(id);
    } else {
      if (topic) {
        topic.controllerInputIds.filter((id) => controllerInputById(id) !== null).forEach(onAddControllerInput);
        onExpand();
        return;
      }
      const id = readControllerInputDragId(event.dataTransfer);
      if (id) onAddControllerInput(id);
    }
    onExpand();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onResizeStart(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onResize(event.clientX);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onResizeEnd();
  };

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 32 : 8;
    if (event.key === 'ArrowLeft') onResizeKeyboard(width + step);
    else if (event.key === 'ArrowRight') onResizeKeyboard(width - step);
    else if (event.key === 'Home') onResizeKeyboard(0);
    else if (event.key === 'End') onResizeKeyboard(maxWidth);
    else if (event.key === 'Enter' || event.key === ' ') collapsed ? onExpand() : onCollapse();
    else return;
    event.preventDefault();
  };

  const clearCurrentView = (): void => {
    if (fieldView) onClearOverlays();
    else if (view === 'graph') onClearGraphSignals();
    else onClearControllerInputs();
  };

  const currentItemCount = fieldView
    ? overlays.length
    : view === 'graph'
      ? graphItems.length
      : controllerInputs.length;

  return (
    <aside
      className={[
        'data-sidebar',
        collapsed && 'data-sidebar-collapsed',
        dropActive && 'data-sidebar-drop-active',
      ].filter(Boolean).join(' ')}
      aria-label={`${viewLabel(view)} sidebar`}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!collapsed ? (
        <>
          <header className="data-sidebar-header">
            <span className="data-sidebar-icon"><Database size={16} /></span>
            <span className="data-sidebar-title">
              <strong>Data sidebar</strong>
              <small>{viewLabel(view)} · {currentItemCount} assigned</small>
            </span>
          </header>

          <div className="data-sidebar-toolbar">
            <span><DropZoneLabel view={view} /></span>
            <span className="data-sidebar-toolbar-actions">
              {fieldView ? (
                <button type="button" disabled={overlays.length === 0} onClick={onHideAllOverlays} title="Hide every overlay">
                  <EyeOff size={12} /> Hide
                </button>
              ) : null}
              <button type="button" disabled={currentItemCount === 0} onClick={clearCurrentView} title="Clear assigned data">
                <Trash2 size={12} /> Clear
              </button>
            </span>
          </div>

          <div className="data-sidebar-body">
            {fieldView ? (
              <>
                <section className="data-structure-card" aria-label="Robot data structure">
                  <header>
                    <span><Bot size={14} /> Robot</span>
                    <em>Rendered</em>
                  </header>
                  <div className="data-robot-identity">
                    <span>
                      <strong>Infantry telemetry</strong>
                      <small>/{robot.robotId}</small>
                    </span>
                    <label>
                      <span>Type</span>
                      <select
                        aria-label="Robot type"
                        value={robot.category}
                        onChange={(event) => onSetRobotCategory(event.target.value as RobotCategory)}
                      >
                        {ROBOT_CATEGORIES.map((category) => (
                          <option value={category.id} key={category.id}>{category.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <dl className="data-slot-grid">
                    <div><dt>Pose X</dt><dd>{robot.xM.toFixed(2)} m</dd></div>
                    <div><dt>Pose Y</dt><dd>{robot.yM.toFixed(2)} m</dd></div>
                    <div><dt>Heading</dt><dd>{robot.yawDeg.toFixed(1)}°</dd></div>
                    <div><dt>Health</dt><dd>{robot.hp} / {robot.maxHp}</dd></div>
                  </dl>
                </section>

                <section className="data-drop-zone" aria-label="Field overlay drop zone">
                  <header>
                    <span><Layers3 size={14} /> Field overlays</span>
                    <em>{overlays.length} layers</em>
                  </header>
                  {overlays.length === 0 ? (
                    <div className="data-drop-empty">
                      <Layers3 size={20} />
                      <strong>Drop overlays here</strong>
                      <small>Accepts poses, detections, and odometry layers</small>
                    </div>
                  ) : overlays.map((overlay, index) => (
                    <div className="data-item-row" key={overlay.id}>
                      <i style={{ background: overlay.color }} />
                      <span>
                        <strong>{overlay.descriptor.name}</strong>
                        <small>{overlay.descriptor.source} · {fieldOverlayStatus(overlay)}</small>
                      </span>
                      <span className="data-order-actions">
                        <button type="button" disabled={index === 0} onClick={() => onMoveOverlay(overlay.id, -1)} aria-label={`Move ${overlay.descriptor.name} up`}><ArrowUp size={10} /></button>
                        <button type="button" disabled={index === overlays.length - 1} onClick={() => onMoveOverlay(overlay.id, 1)} aria-label={`Move ${overlay.descriptor.name} down`}><ArrowDown size={10} /></button>
                      </span>
                      <button type="button" onClick={() => onToggleOverlayVisibility(overlay.id)} aria-label={`${overlay.visible ? 'Hide' : 'Show'} ${overlay.descriptor.name}`}>
                        {overlay.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button type="button" onClick={() => onRemoveOverlay(overlay.id)} aria-label={`Remove ${overlay.descriptor.name}`}><X size={12} /></button>
                    </div>
                  ))}
                </section>
              </>
            ) : view === 'graph' ? (
              <section className="data-drop-zone" aria-label="Graph signal drop zone">
                <header>
                  <span><LineChart size={14} /> Graph signals</span>
                  <em>{graphItems.length} series</em>
                </header>
                {graphItems.length === 0 ? (
                  <div className="data-drop-empty">
                    <LineChart size={20} />
                    <strong>Drop numeric signals here</strong>
                    <small>Each series gets an explicit colour category</small>
                  </div>
                ) : graphItems.map(({ config, descriptor }: { config: GraphSignalConfig; descriptor: GraphSignalDescriptor }) => (
                  <div className="data-item-row data-graph-row" key={config.id}>
                    <i style={{ background: graphColorForCategory(config.colorCategory) }} />
                    <span>
                      <strong>{descriptor.robotName} · {descriptor.label}</strong>
                      <small>{descriptor.topic} · {descriptor.format(descriptor.sampleAt(currentTimeS))}</small>
                    </span>
                    <label className="data-color-category">
                      <span>Colour</span>
                      <select
                        aria-label={`Colour category for ${descriptor.robotName} ${descriptor.label}`}
                        value={config.colorCategory}
                        onChange={(event) => onSetGraphColor(config.id, event.target.value as GraphColorCategory)}
                      >
                        {GRAPH_COLOR_CATEGORIES.map((category) => (
                          <option value={category.id} key={category.id}>{category.label}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={() => onRemoveGraphSignal(config.id)} aria-label={`Remove ${descriptor.robotName} ${descriptor.label}`}><X size={12} /></button>
                  </div>
                ))}
              </section>
            ) : (
              <section className="data-drop-zone data-controller-zone" aria-label="Controller input drop zone">
                <header>
                  <span><Gamepad2 size={14} /> Controller slots</span>
                  <em>{controllerInputs.length} / {CONTROLLER_SLOTS.length}</em>
                </header>
                <div className="data-controller-slots">
                  {CONTROLLER_SLOTS.map((slot) => {
                    const input = controllerInputByControl.get(slot.control);
                    const value = input?.sampleAt(currentTimeS);
                    return (
                      <div className={input ? 'data-controller-slot data-controller-slot-filled' : 'data-controller-slot'} key={slot.control}>
                        <span>
                          <strong>{slot.label}</strong>
                          <small>{slot.kind}</small>
                        </span>
                        {input && value !== undefined ? <output>{input.format(value)}</output> : <em>Empty</em>}
                        {input ? (
                          <button type="button" onClick={() => onRemoveControllerInput(input.id)} aria-label={`Remove ${input.label}`}><X size={12} /></button>
                        ) : <span className="data-slot-target" aria-hidden="true" />}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </>
      ) : null}

      {dropActive ? (
        <div className="data-sidebar-drop-message" aria-hidden="true">
          {fieldView ? <Layers3 size={18} /> : view === 'graph' ? <LineChart size={18} /> : <Gamepad2 size={18} />}
          Drop into highlighted zone
        </div>
      ) : null}

      <div
        className="data-sidebar-grip"
        role="separator"
        tabIndex={0}
        aria-label={collapsed ? 'Expand data sidebar' : 'Resize data sidebar'}
        aria-orientation="vertical"
        aria-valuemax={maxWidth}
        aria-valuemin={minWidth}
        aria-valuenow={Math.round(width)}
        title={`${collapsed ? 'Pull to open' : 'Drag to resize'} · ${window.knightSim?.platform === 'darwin' ? 'Command+Option+B' : 'Ctrl+Alt+B'}`}
        onDoubleClick={collapsed ? onExpand : onCollapse}
        onKeyDown={handleResizeKeyDown}
        onLostPointerCapture={onResizeEnd}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        <GripVertical size={14} />
      </div>
    </aside>
  );
}
