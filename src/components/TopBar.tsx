import { Box, ChartLine, Gamepad2 } from 'lucide-react';
import type { ControllerMode, FieldMode, ViewMode } from '../types';

const FIELD_MODE_LABELS: Readonly<Record<FieldMode, string>> = {
  '1v1': '1v1', sentry: 'Sentry', '3v3': '3v3', drone: 'Drone', dart: 'Dart',
};

const CONTROLLER_MODE_OPTIONS = [
  { mode: 'kbm', label: 'KBM' },
  { mode: 'xbox', label: 'Xbox' },
  { mode: 'ps5', label: 'PS5' },
  { mode: 'dji', label: 'DJI' },
] as const satisfies readonly { readonly mode: ControllerMode; readonly label: string }[];

interface TopBarProps {
  readonly activeView: ViewMode;
  readonly demoEnabled: boolean;
  readonly controllerMode: ControllerMode;
  readonly fieldMode: FieldMode;
  readonly onDemoChange: (enabled: boolean) => void;
  readonly onControllerModeChange: (mode: ControllerMode) => void;
  readonly onFieldModeChange: (mode: FieldMode) => void;
  readonly onViewChange: (view: ViewMode) => void;
}

export function TopBar({
  activeView,
  demoEnabled,
  controllerMode,
  fieldMode,
  onDemoChange,
  onControllerModeChange,
  onFieldModeChange,
  onViewChange,
}: TopBarProps) {
  return (
    <header className="topbar">
      <button
        className="demo-toggle"
        type="button"
        role="switch"
        aria-label="Demo"
        aria-checked={demoEnabled}
        title="Use demonstration telemetry"
        onClick={() => onDemoChange(!demoEnabled)}
      >
        <span>Demo</span>
        <span className="demo-toggle-track" aria-hidden="true"><span /></span>
        <span className="demo-toggle-state" aria-hidden="true">{demoEnabled ? 'On' : 'Off'}</span>
      </button>

      <nav className="view-tabs" aria-label="Workspace views">
        <button
          className={activeView === 'field' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          aria-label="Field"
          title="Field"
          aria-current={activeView === 'field' ? 'page' : undefined}
          onClick={() => onViewChange('field')}
        >
          <Box size={15} aria-hidden="true" />
          <span className="view-tab-label">Field</span>
        </button>
        <button
          className={activeView === 'graph' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          aria-label="Graphs"
          title="Graphs"
          aria-current={activeView === 'graph' ? 'page' : undefined}
          onClick={() => onViewChange('graph')}
        >
          <ChartLine size={15} aria-hidden="true" />
          <span className="view-tab-label">Graphs</span>
        </button>
        <button
          className={activeView === 'controller' ? 'view-tab view-tab-active' : 'view-tab'}
          type="button"
          aria-label="Controller"
          title="Controller"
          aria-current={activeView === 'controller' ? 'page' : undefined}
          onClick={() => onViewChange('controller')}
        >
          <Gamepad2 size={15} aria-hidden="true" />
          <span className="view-tab-label">Controller</span>
        </button>
      </nav>

      {activeView === 'field' ? (
        <div className="field-mode-selector" role="group" aria-label="Field format">
          {(['1v1', 'sentry', '3v3', 'drone', 'dart'] as const).map((mode) => (
            <button
              key={mode}
              className={fieldMode === mode ? 'field-mode-option field-mode-option-active' : 'field-mode-option'}
              type="button"
              aria-pressed={fieldMode === mode}
              onClick={() => onFieldModeChange(mode)}
            >
              {FIELD_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      ) : activeView === 'controller' ? (
        <div className="controller-mode-selector" role="group" aria-label="Controller type">
          {CONTROLLER_MODE_OPTIONS.map(({ mode, label }) => (
            <button
              key={mode}
              className={controllerMode === mode ? 'controller-mode-option controller-mode-option-active' : 'controller-mode-option'}
              type="button"
              aria-pressed={controllerMode === mode}
              onClick={() => onControllerModeChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}
