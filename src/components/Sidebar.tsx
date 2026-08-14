import type { KeyboardEvent, PointerEvent } from 'react';
import { Box, Settings2 } from 'lucide-react';
import type { RobotTelemetry } from '../types';
import { Inspector } from './Inspector';

interface SidebarProps {
  readonly compact: boolean;
  readonly maxWidth: number;
  readonly minWidth: number;
  readonly robot: RobotTelemetry;
  readonly width: number;
  readonly onResize: (pointerX: number) => void;
  readonly onResizeEnd: () => void;
  readonly onResizeKeyboard: (width: number) => void;
  readonly onResizeStart: (pointerX: number) => void;
}

export function Sidebar({
  compact,
  maxWidth,
  minWidth,
  robot,
  width,
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
        <div className="brand-mark" aria-hidden="true">
          <Box size={16} strokeWidth={2.4} />
        </div>
        <div className="sidebar-brand-copy">
          <div className="brand-title">KnightSim</div>
          <div className="brand-subtitle">ARCC telemetry workbench</div>
        </div>
      </div>

      <div className="sidebar-body">
        <Inspector robot={robot} collapsed={compact} />
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-settings" type="button" aria-label="Settings" title="Settings">
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
