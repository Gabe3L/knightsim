import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Layers3,
  PanelRightClose,
  Trash2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  FIELD_OVERLAY_DRAG_TYPE,
  readFieldOverlayDragId,
  type ResolvedFieldOverlay,
} from '../overlays/fieldOverlays';

interface FieldOverlaySidebarProps {
  readonly collapsed: boolean;
  readonly maxWidth: number;
  readonly minWidth: number;
  readonly overlays: readonly ResolvedFieldOverlay[];
  readonly width: number;
  readonly onAdd: (id: string) => void;
  readonly onClear: () => void;
  readonly onCollapse: () => void;
  readonly onExpand: () => void;
  readonly onHideAll: () => void;
  readonly onMove: (id: string, direction: -1 | 1) => void;
  readonly onRemove: (id: string) => void;
  readonly onResize: (pointerX: number) => void;
  readonly onResizeEnd: () => void;
  readonly onResizeKeyboard: (width: number) => void;
  readonly onResizeStart: (pointerX: number) => void;
  readonly onToggleVisibility: (id: string) => void;
}

const statusLabel = (overlay: ResolvedFieldOverlay): string => {
  if (!overlay.sample.available) return 'Unavailable';
  switch (overlay.sample.status) {
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Rejected';
    case 'predicted': return 'Predicted';
    case 'reference': return 'Reference';
    default: return 'Available';
  }
};

export function FieldOverlaySidebar({
  collapsed,
  maxWidth,
  minWidth,
  overlays,
  width,
  onAdd,
  onClear,
  onCollapse,
  onExpand,
  onHideAll,
  onMove,
  onRemove,
  onResize,
  onResizeEnd,
  onResizeKeyboard,
  onResizeStart,
  onToggleVisibility,
}: FieldOverlaySidebarProps) {
  const [dropActive, setDropActive] = useState(false);
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!focusRequestId) return;
    const row = rowRefs.current.get(focusRequestId);
    if (!row) return;
    row.focus();
    row.classList.remove('field-overlay-row-focused');
    window.requestAnimationFrame(() => row.classList.add('field-overlay-row-focused'));
    const timeout = window.setTimeout(() => row.classList.remove('field-overlay-row-focused'), 700);
    setFocusRequestId(null);
    return () => window.clearTimeout(timeout);
  }, [focusRequestId, overlays]);

  const supportsDrag = (event: DragEvent<HTMLElement>): boolean => (
    Array.from(event.dataTransfer.types).includes(FIELD_OVERLAY_DRAG_TYPE)
  );

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
    event.preventDefault();
    setDropActive(false);
    const id = readFieldOverlayDragId(event.dataTransfer);
    if (!id) return;
    onAdd(id);
    onExpand();
    setFocusRequestId(id);
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

  return (
    <aside
      className={[
        'field-overlay-sidebar',
        collapsed && 'field-overlay-sidebar-collapsed',
        dropActive && 'field-overlay-sidebar-drop-active',
      ].filter(Boolean).join(' ')}
      aria-label="Field overlays"
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!collapsed ? (
        <>
          <header className="field-overlay-sidebar-header">
            <span className="field-overlay-sidebar-icon"><Layers3 size={16} /></span>
            <span className="field-overlay-sidebar-title">
              <strong>Field overlays</strong>
              <small>{overlays.length} layer{overlays.length === 1 ? '' : 's'}</small>
            </span>
            <button
              type="button"
              aria-label="Collapse field overlays sidebar"
              title="Collapse field overlays sidebar (Ctrl+Alt+B)"
              onClick={onCollapse}
            >
              <PanelRightClose size={15} />
            </button>
          </header>

          <div className="field-overlay-sidebar-toolbar">
            <button type="button" disabled={overlays.length === 0} onClick={onHideAll} title="Hide every overlay">
              <EyeOff size={12} /> Hide all
            </button>
            <button type="button" disabled={overlays.length === 0} onClick={onClear} title="Remove every overlay">
              <Trash2 size={12} /> Clear all
            </button>
          </div>

          <div className="field-overlay-list" aria-live="polite">
            {overlays.length === 0 ? (
              <div className="field-overlay-empty">
                <span><Layers3 size={23} /></span>
                <strong>Display odometry on the field</strong>
                <p>Drag a supported pose or detection from the left sidebar and drop it here.</p>
              </div>
            ) : overlays.map((overlay, index) => {
              const status = statusLabel(overlay);
              return (
                <div
                  className={[
                    'field-overlay-row',
                    !overlay.sample.available && 'field-overlay-row-unavailable',
                    overlay.sample.status === 'rejected' && 'field-overlay-row-rejected',
                  ].filter(Boolean).join(' ')}
                  key={overlay.id}
                  ref={(element) => {
                    if (element) rowRefs.current.set(overlay.id, element);
                    else rowRefs.current.delete(overlay.id);
                  }}
                  tabIndex={-1}
                >
                  <i className="field-overlay-color" style={{ background: overlay.color }} />
                  <span className="field-overlay-row-copy">
                    <strong>{overlay.descriptor.name}</strong>
                    <small>{overlay.descriptor.source}</small>
                    <em title={overlay.sample.unavailableReason}>{status}</em>
                  </span>
                  <span className="field-overlay-row-actions">
                    <span className="field-overlay-order-actions">
                      <button type="button" disabled={index === 0} onClick={() => onMove(overlay.id, -1)} aria-label={`Move ${overlay.descriptor.name} up`} title="Move layer up">
                        <ArrowUp size={11} />
                      </button>
                      <button type="button" disabled={index === overlays.length - 1} onClick={() => onMove(overlay.id, 1)} aria-label={`Move ${overlay.descriptor.name} down`} title="Move layer down">
                        <ArrowDown size={11} />
                      </button>
                    </span>
                    <button type="button" onClick={() => onToggleVisibility(overlay.id)} aria-pressed={overlay.visible} aria-label={`${overlay.visible ? 'Hide' : 'Show'} ${overlay.descriptor.name}`} title={overlay.visible ? 'Hide overlay' : 'Show overlay'}>
                      {overlay.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button type="button" onClick={() => onRemove(overlay.id)} aria-label={`Remove ${overlay.descriptor.name}`} title="Remove overlay">
                      <X size={13} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {dropActive ? (
        <div className="field-overlay-drop-message" aria-hidden="true">
          <Layers3 size={18} /> Drop to display
        </div>
      ) : null}

      <div
        className="field-overlay-sidebar-resize-handle"
        role="separator"
        tabIndex={0}
        aria-label={collapsed ? 'Expand field overlays sidebar' : 'Resize field overlays sidebar'}
        aria-orientation="vertical"
        aria-valuemax={maxWidth}
        aria-valuemin={minWidth}
        aria-valuenow={Math.round(width)}
        title={collapsed ? 'Drag to open field overlays (Ctrl+Alt+B)' : 'Drag to resize field overlays'}
        onDoubleClick={collapsed ? onExpand : onCollapse}
        onKeyDown={handleResizeKeyDown}
        onLostPointerCapture={onResizeEnd}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      />
    </aside>
  );
}
