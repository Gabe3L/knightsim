import { Box, CircleDot, Radio } from 'lucide-react';
import type { ViewMode } from '../types';

interface TopBarProps {
  readonly activeView: ViewMode;
  readonly onViewChange: (view: ViewMode) => void;
}

export function TopBar({ activeView, onViewChange }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="document-title">
        <div>
          <div className="document-name">ARCC 2026 Simulation</div>
          <div className="document-context">KnightSim replay workspace</div>
        </div>
      </div>

      <nav className="view-tabs" aria-label="Field view">
        <button
          className={activeView === '2d' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          onClick={() => onViewChange('2d')}
        >
          <CircleDot size={15} />
          2D Field
        </button>
        <button
          className={activeView === '3d' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          onClick={() => onViewChange('3d')}
        >
          <Box size={15} />
          3D Field
        </button>
      </nav>

      <div className="topbar-actions">
        <div className="live-pill"><Radio size={12} /> MOCK LIVE</div>
      </div>
    </header>
  );
}
