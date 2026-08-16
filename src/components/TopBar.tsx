import { Box, ChartLine, CircleDot, Gamepad2, Route } from 'lucide-react';
import type { ViewMode } from '../types';

interface TopBarProps {
  readonly activeView: ViewMode;
  readonly onViewChange: (view: ViewMode) => void;
}

export function TopBar({ activeView, onViewChange }: TopBarProps) {
  return (
    <header className="topbar">
      <nav className="view-tabs" aria-label="Workspace views">
        <button
          className={activeView === '2d' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          onClick={() => onViewChange('2d')}
        >
          <CircleDot size={15} />
          2D
        </button>
        <button
          className={activeView === '3d' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          onClick={() => onViewChange('3d')}
        >
          <Box size={15} />
          3D
        </button>
        <button className="view-tab view-tab-placeholder" type="button" disabled title="Odometry view coming soon">
          <Route size={15} />
          Odometry
        </button>
        <button
          className={activeView === 'graph' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          onClick={() => onViewChange('graph')}
        >
          <ChartLine size={15} />
          Line Graph
        </button>
        <button className="view-tab view-tab-placeholder" type="button" disabled title="Joysticks view coming soon">
          <Gamepad2 size={15} />
          Joysticks
        </button>
      </nav>

    </header>
  );
}
