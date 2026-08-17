import { Box, ChartLine, Gamepad2 } from 'lucide-react';
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
          className={activeView === 'field' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          onClick={() => onViewChange('field')}
        >
          <Box size={15} />
          Field
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
