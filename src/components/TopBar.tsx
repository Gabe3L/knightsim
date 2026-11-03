import { robotProfile } from '../robots/profiles';
import { FIELD_ROBOT_IDS } from '../field/fieldRobots';
import { Box, ChartLine, Gamepad2 } from 'lucide-react';
import type { ControllerMode, FieldMode, RobotId, ViewMode } from '../types';

const FIELD_MODE_LABELS: Readonly<Record<FieldMode, string>> = {
  '1v1': '1v1', sentry: 'Sentry', '3v3': '3v3', drone: 'Drone', dart: 'Dart',
};

const CONTROLLER_MODE_OPTIONS = [
  { mode: 'kbm', label: 'KBM' },
  { mode: 'xbox', label: 'Xbox' },
  { mode: 'ps5', label: 'PS5' },
  { mode: 'dji', label: 'DJI' },
] as const satisfies readonly { readonly mode: ControllerMode; readonly label: string }[];

const CONTROLLER_MODE_TITLES: Readonly<Record<ControllerMode, string>> = {
  kbm: 'Keyboard + Mouse',
  xbox: 'Xbox Controller',
  ps5: 'PS5 Controller',
  dji: 'DJI Controller',
};

interface TopBarProps {
  readonly robotId: RobotId;
  readonly onRobotChange: (id: RobotId) => void;
  readonly activeView: ViewMode;
  readonly connected: boolean;
  readonly controllerInputCount: number;
  readonly controllerMode: ControllerMode;
  readonly fieldMode: FieldMode;
  readonly graphSignalCount: number;
  readonly playing: boolean;
  readonly onControllerModeChange: (mode: ControllerMode) => void;
  readonly onFieldModeChange: (mode: FieldMode) => void;
  readonly onViewChange: (view: ViewMode) => void;
}

export function TopBar({
  robotId,
  onRobotChange,
  activeView,
  connected,
  controllerInputCount,
  controllerMode,
  fieldMode,
  graphSignalCount,
  playing,
  onControllerModeChange,
  onFieldModeChange,
  onViewChange,
}: TopBarProps) {
  const context = activeView === 'field'
    ? { eyebrow: 'Field', label: `${FIELD_MODE_LABELS[fieldMode]} ${fieldMode === 'drone' || fieldMode === 'dart' ? 'Challenge' : 'Battlefield'}` }
    : activeView === 'graph'
      ? {
        eyebrow: 'Line Graph',
        label: graphSignalCount === 0
          ? 'No signals selected'
          : `${graphSignalCount} signal${graphSignalCount === 1 ? '' : 's'} plotted`,
      }
      : {
        eyebrow: 'Controller',
        label: CONTROLLER_MODE_TITLES[controllerMode],
      };

  return (
    <header className="topbar">
      <div className="topbar-context" aria-label={`${context.eyebrow}, ${context.label}`}>
        <span>{context.eyebrow}</span>
        {activeView === 'field' ? (
          <select className="robot-preview-select" value={robotId} aria-label="Preview robot"
            onChange={(event) => onRobotChange(event.currentTarget.value)}>
            {FIELD_ROBOT_IDS[fieldMode].map(robotProfile).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · Demo</option>)}
          </select>
        ) : <strong>{context.label}</strong>}
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
