import type { KeyboardEvent, PointerEvent } from 'react';
import { Settings2 } from 'lucide-react';
import logo from '../assets/logo.png';
import type { ResolvedFieldOverlay } from '../overlays/fieldOverlays';
import type { RobotTelemetry } from '../types';
import { Inspector } from './Inspector';

interface SidebarProps {
  readonly compact: boolean;
  readonly maxWidth: number;
  readonly minWidth: number;
  readonly robot: RobotTelemetry;
  readonly currentTimeS: number;
  readonly width: number;
  readonly controllerInputIds: readonly string[];
  readonly graphSignalIds: readonly string[];
  readonly overlays: readonly ResolvedFieldOverlay[];
  readonly onToggleControllerInput: (id: string) => void;
  readonly onToggleFieldOverlay: (id: string) => void;
  readonly onToggleGraphSignal: (id: string) => void;
  readonly onOpenSettings: () => void;
  readonly onResize: (pointerX: number) => void;
  readonly onResizeEnd: () => void;
  readonly onResizeKeyboard: (width: number) => void;
  readonly onResizeStart: (pointerX: number) => void;
}

export function Sidebar({
  compact,
  currentTimeS,
  maxWidth,
  minWidth,
  robot,
  width,
  controllerInputIds,
  graphSignalIds,
  overlays,
  onToggleControllerInput,
  onToggleFieldOverlay,
  onToggleGraphSignal,
  onOpenSettings,
  onResize,
  onResizeEnd,
  onResizeKeyboard,
  onResizeStart,
}: SidebarProps) {
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 32 : 8;
    if (event.key === 'ArrowLeft') onResizeKeyboard(width - step);
    else if (event.key === 'ArrowRight') onResizeKeyboard(width + step);
    else if (event.key === 'Home') onResizeKeyboard(minWidth);
    else if (event.key === 'End') onResizeKeyboard(maxWidth);
    else return;
    event.preventDefault();
  };

  return (
    <aside className={compact ? 'sidebar sidebar-compact' : 'sidebar'}>
      <div className="window-controls-bar" aria-hidden="true" />

      <div className="sidebar-brand-row">
        <img className="brand-logo" src={logo} alt="" aria-hidden="true" />
        <div className="sidebar-brand-copy">
          <div className="brand-title">KnightSim</div>
        </div>
      </div>

      <div className="sidebar-body">
        <Inspector
          robot={robot}
          currentTimeS={currentTimeS}
          collapsed={compact}
          controllerInputIds={controllerInputIds}
          graphSignalIds={graphSignalIds}
          overlays={overlays}
          onToggleControllerInput={onToggleControllerInput}
          onToggleFieldOverlay={onToggleFieldOverlay}
          onToggleGraphSignal={onToggleGraphSignal}
        />
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-settings" type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings}>
          <Settings2 size={18} />
          <span>Settings</span>
        </button>
      </div>

      <div
        className="sidebar-resize-handle"
        role="separator"
        tabIndex={0}
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemax={maxWidth}
        aria-valuemin={minWidth}
        aria-valuenow={Math.round(width)}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={onResizeEnd}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      />
    </aside>
  );
}
