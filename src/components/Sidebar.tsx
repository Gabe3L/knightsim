import { Box, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import type { RobotTelemetry } from '../types';
import { Inspector } from './Inspector';

interface SidebarProps {
  readonly collapsed: boolean;
  readonly robot: RobotTelemetry;
  readonly onToggle: () => void;
}

export function Sidebar({ collapsed, robot, onToggle }: SidebarProps) {
  return (
    <aside className={collapsed ? 'sidebar sidebar-collapsed' : 'sidebar'}>
      <div className="window-controls-bar" aria-hidden="true" />

      <div className="sidebar-brand-row">
        <div className="brand-mark" aria-hidden="true">
          <Box size={16} strokeWidth={2.4} />
        </div>
        <div className="sidebar-brand-copy">
          <div className="brand-title">KnightSim</div>
          <div className="brand-subtitle">ARCC telemetry workbench</div>
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <div className="sidebar-body">
        <Inspector robot={robot} collapsed={collapsed} />
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-settings" type="button" aria-label="Settings" title="Settings">
          <Settings2 size={18} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
