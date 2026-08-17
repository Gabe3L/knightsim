import { Box, ChartLine, CircleDot, Gamepad2 } from 'lucide-react';
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
        <button
          className={activeView === 'graph' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          onClick={() => onViewChange('graph')}
        >
          <ChartLine size={15} />
          Line Graph
        </button>
        <button
          className={activeView === 'controller' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          onClick={() => onViewChange('controller')}
        >
          <Gamepad2 size={15} />
          Controller
        </button>
      </nav>

    </header>
  );
}
