import { Box, ChartLine, Gamepad2 } from 'lucide-react';
import type { ViewMode } from '../types';

interface TopBarProps {
  readonly activeView: ViewMode;
  readonly connected: boolean;
  readonly controllerInputCount: number;
  readonly graphSignalCount: number;
  readonly playing: boolean;
  readonly onViewChange: (view: ViewMode) => void;
}

export function TopBar({
  activeView,
  connected,
  controllerInputCount,
  graphSignalCount,
  playing,
  onViewChange,
}: TopBarProps) {
  const context = activeView === 'field'
    ? { eyebrow: 'Field', label: '3v3 Battlefield' }
    : activeView === 'graph'
      ? {
        eyebrow: 'Line Graph',
        label: graphSignalCount === 0
          ? 'No signals selected'
          : `${graphSignalCount} signal${graphSignalCount === 1 ? '' : 's'} plotted`,
      }
      : {
        eyebrow: 'Controller',
        label: controllerInputCount === 0
          ? 'No inputs mapped'
          : `${controllerInputCount} input${controllerInputCount === 1 ? '' : 's'} mapped`,
      };

  return (
    <header className="topbar">
      <div className="topbar-context" aria-label={`${context.eyebrow}, ${context.label}`}>
        <span>{context.eyebrow}</span>
        <strong>{context.label}</strong>
      </div>

      <nav className="view-tabs" aria-label="Workspace views">
        <button
          className={activeView === 'field' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          aria-current={activeView === 'field' ? 'page' : undefined}
          onClick={() => onViewChange('field')}
        >
          <Box size={15} />
          Field
        </button>
        <button
          className={activeView === 'graph' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          aria-current={activeView === 'graph' ? 'page' : undefined}
          onClick={() => onViewChange('graph')}
        >
          <ChartLine size={15} />
          Line Graph
        </button>
        <button
          className={activeView === 'controller' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          aria-current={activeView === 'controller' ? 'page' : undefined}
          onClick={() => onViewChange('controller')}
        >
          <Gamepad2 size={15} />
          Controller
        </button>
      </nav>
    </header>
  );
}
