import { Box, CircleDot, Radio, Settings2 } from 'lucide-react';
import type { ViewMode } from '../types';

interface TopBarProps {
  readonly activeView: ViewMode;
  readonly onViewChange: (view: ViewMode) => void;
}

export function TopBar({ activeView, onViewChange }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">
          <Box size={16} strokeWidth={2.4} />
        </div>
        <div>
          <div className="brand-title">KnightSim</div>
          <div className="brand-subtitle">ARCC telemetry workbench</div>
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
        <button className="icon-button" type="button" aria-label="Settings">
          <Settings2 size={17} />
        </button>
      </div>
    </header>
  );
}
