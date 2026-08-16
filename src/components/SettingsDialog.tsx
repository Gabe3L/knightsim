import {
  Bot,
  Box,
  FileKey,
  Gauge,
  Keyboard,
  KeyRound,
  Network,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  Wifi,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ModelAxis, RobotId, RobotModelLibrary, RobotModelOrientation } from '../types';
import '../styles/settings.css';

interface SettingsDialogProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly library: RobotModelLibrary;
  readonly loading: boolean;
  readonly onClearError: () => void;
  readonly onClose: () => void;
  readonly onImport: (robotId: RobotId) => void;
  readonly onRemove: (id: string) => void;
  readonly onSelect: (robotId: RobotId, id: string | null) => void;
  readonly onUpdateOrientation: (id: string, orientation: RobotModelOrientation) => void;
}

type SettingsPage = 'settings' | 'connectivity' | 'keybindings';
type AuthenticationMethod = 'key' | 'password';

interface RobotOption {
  readonly id: RobotId;
  readonly name: string;
}

interface TuningSettings {
  readonly coefficientOfFriction: number;
  readonly maxAcceleration: number;
  readonly maxDriveSpeed: number;
  readonly maxAngularSpeed: number;
  readonly robotMass: number;
  readonly wheelRadius: number;
  readonly controlFrequency: number;
  readonly driveCurrentLimit: number;
  readonly simulateBatterySag: boolean;
  readonly enableCollisions: boolean;
}

interface ConnectivitySettings {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly authentication: AuthenticationMethod;
  readonly privateKeyPath: string;
  readonly password: string;
  readonly connectTimeout: number;
  readonly keepAlive: number;
  readonly autoReconnect: boolean;
  readonly verifyHostKey: boolean;
  readonly compression: boolean;
  readonly telemetryPort: number;
  readonly remoteWorkspace: string;
}

const ROBOTS: readonly RobotOption[] = [
  { id: 'sentry', name: 'Sentry' },
  { id: 'infantry', name: 'Infantry' },
  { id: 'hero', name: 'Hero' },
];

const DEFAULT_TUNING: Record<RobotId, TuningSettings> = {
  sentry: {
    coefficientOfFriction: 0.86,
    maxAcceleration: 4.8,
    maxDriveSpeed: 4.2,
    maxAngularSpeed: 420,
    robotMass: 118,
    wheelRadius: 76,
    controlFrequency: 200,
    driveCurrentLimit: 60,
    simulateBatterySag: true,
    enableCollisions: true,
  },
  infantry: {
    coefficientOfFriction: 0.82,
    maxAcceleration: 6.5,
    maxDriveSpeed: 5.2,
    maxAngularSpeed: 540,
    robotMass: 44.5,
    wheelRadius: 60,
    controlFrequency: 250,
    driveCurrentLimit: 40,
    simulateBatterySag: true,
    enableCollisions: true,
  },
  hero: {
    coefficientOfFriction: 0.8,
    maxAcceleration: 5.4,
    maxDriveSpeed: 4.6,
    maxAngularSpeed: 460,
    robotMass: 52,
    wheelRadius: 76,
    controlFrequency: 250,
    driveCurrentLimit: 50,
    simulateBatterySag: true,
    enableCollisions: true,
  },
};

const DEFAULT_CONNECTIVITY: Record<RobotId, ConnectivitySettings> = {
  sentry: {
    host: 'sentry.local', port: 22, username: 'ubuntu', authentication: 'key',
    privateKeyPath: '~/.ssh/id_ed25519', password: '', connectTimeout: 8, keepAlive: 15,
    autoReconnect: true, verifyHostKey: true, compression: false, telemetryPort: 5800,
    remoteWorkspace: '/home/ubuntu/knightsim',
  },
  infantry: {
    host: 'infantry.local', port: 22, username: 'ubuntu', authentication: 'key',
    privateKeyPath: '~/.ssh/id_ed25519', password: '', connectTimeout: 8, keepAlive: 15,
    autoReconnect: true, verifyHostKey: true, compression: false, telemetryPort: 5800,
    remoteWorkspace: '/home/ubuntu/knightsim',
  },
  hero: {
    host: 'hero.local', port: 22, username: 'ubuntu', authentication: 'key',
    privateKeyPath: '~/.ssh/id_ed25519', password: '', connectTimeout: 8, keepAlive: 15,
    autoReconnect: true, verifyHostKey: true, compression: false, telemetryPort: 5800,
    remoteWorkspace: '/home/ubuntu/knightsim',
  },
};

const TUNING_STORAGE_KEY = 'knightsim:tuning-settings:v1';
const CONNECTIVITY_STORAGE_KEY = 'knightsim:connectivity-settings:v1';
const AXES: readonly ModelAxis[] = ['x', 'y', 'z'];

function loadSettings<T extends object>(key: string, defaults: Record<RobotId, T>): Record<RobotId, T> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return defaults;
    const stored = parsed as Partial<Record<RobotId, Partial<T>>>;
    return Object.fromEntries(ROBOTS.map(({ id }) => [
      id,
      { ...defaults[id], ...(stored[id] ?? {}) },
    ])) as Record<RobotId, T>;
  } catch {
    return defaults;
  }
}

const formatFileSize = (sizeBytes: number): string => {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const rotate = (orientation: RobotModelOrientation, axis: ModelAxis): RobotModelOrientation => ({
  ...orientation,
  rotationDeg: {
    ...orientation.rotationDeg,
    [axis]: (orientation.rotationDeg[axis] + 90) % 360,
  },
});

const flip = (orientation: RobotModelOrientation, axis: ModelAxis): RobotModelOrientation => ({
  ...orientation,
  flipped: {
    ...orientation.flipped,
    [axis]: !orientation.flipped[axis],
  },
});

const RESET_ORIENTATION: RobotModelOrientation = {
  rotationDeg: { x: 0, y: 0, z: 0 },
  flipped: { x: false, y: false, z: false },
};

interface SettingRowProps {
  readonly children: React.ReactNode;
  readonly description: string;
  readonly label: string;
}

function SettingRow({ children, description, label }: SettingRowProps) {
  return (
    <div className="setting-row">
      <div className="setting-row-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

interface ToggleProps {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}

function Toggle({ checked, label, onChange }: ToggleProps) {
  return (
    <button
      className={checked ? 'settings-toggle checked' : 'settings-toggle'}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function SettingsDialog({
  busy,
  error,
  library,
  loading,
  onClearError,
  onClose,
  onImport,
  onRemove,
  onSelect,
  onUpdateOrientation,
}: SettingsDialogProps) {
  const [page, setPage] = useState<SettingsPage>('settings');
  const [selectedRobotId, setSelectedRobotId] = useState<RobotId>('infantry');
  const [tuningByRobot, setTuningByRobot] = useState(() => (
    loadSettings(TUNING_STORAGE_KEY, DEFAULT_TUNING)
  ));
  const [connectivityByRobot, setConnectivityByRobot] = useState(() => (
    loadSettings(CONNECTIVITY_STORAGE_KEY, DEFAULT_CONNECTIVITY)
  ));

  const selectedRobot = ROBOTS.find((robot) => robot.id === selectedRobotId) ?? ROBOTS[1]!;
  const tuning = tuningByRobot[selectedRobotId];
  const connectivity = connectivityByRobot[selectedRobotId];
  const activeModel = library.models.find(
    (model) => model.id === library.modelIdByRobot[selectedRobotId],
  ) ?? null;

  useEffect(() => {
    window.localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(tuningByRobot));
  }, [tuningByRobot]);

  useEffect(() => {
    const nonSecretSettings = Object.fromEntries(ROBOTS.map(({ id }) => {
      const { password: _password, ...safeSettings } = connectivityByRobot[id];
      return [id, safeSettings];
    }));
    window.localStorage.setItem(CONNECTIVITY_STORAGE_KEY, JSON.stringify(nonSecretSettings));
  }, [connectivityByRobot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  const updateTuning = <K extends keyof TuningSettings>(key: K, value: TuningSettings[K]): void => {
    setTuningByRobot((current) => ({
      ...current,
      [selectedRobotId]: { ...current[selectedRobotId], [key]: value },
    }));
  };

  const updateConnectivity = <K extends keyof ConnectivitySettings>(
    key: K,
    value: ConnectivitySettings[K],
  ): void => {
    setConnectivityByRobot((current) => ({
      ...current,
      [selectedRobotId]: { ...current[selectedRobotId], [key]: value },
    }));
  };

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div className="settings-title">
            <span className="eyebrow">KNIGHTSIM</span>
            <h2 id="settings-title">Preferences</h2>
          </div>
          <nav className="settings-page-tabs" aria-label="Preference pages" role="tablist">
            <button
              className={page === 'settings' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={page === 'settings'}
              onClick={() => setPage('settings')}
            >
              <Settings2 size={16} />
              Settings
            </button>
            <button
              className={page === 'connectivity' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={page === 'connectivity'}
              onClick={() => setPage('connectivity')}
            >
              <Wifi size={16} />
              Connectivity
            </button>
            <button
              className={page === 'keybindings' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={page === 'keybindings'}
              onClick={() => setPage('keybindings')}
            >
              <Keyboard size={16} />
              Keybindings
            </button>
          </nav>
          <button className="settings-close-button" type="button" onClick={onClose} disabled={busy} aria-label="Close preferences">
            <X size={18} />
          </button>
        </header>

        <div className="settings-content">
          {page !== 'keybindings' ? (
            <div className="robot-picker-shell">
              <div className="robot-picker-label">
                <span>Configure robot</span>
                <small>Settings are stored separately for each profile.</small>
              </div>
              <div className="robot-picker" role="group" aria-label="Robot profile">
                {ROBOTS.map((robot) => (
                  <button
                    className={robot.id === selectedRobotId ? 'active' : ''}
                    type="button"
                    key={robot.id}
                    aria-pressed={robot.id === selectedRobotId}
                    onClick={() => setSelectedRobotId(robot.id)}
                  >
                    <Bot size={15} />
                    <span><strong>{robot.name}</strong></span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="settings-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={onClearError} aria-label="Dismiss error"><X size={14} /></button>
            </div>
          ) : null}

          {page === 'settings' ? (
            <div className="settings-page" role="tabpanel">
              <section className="settings-group">
                <div className="settings-group-heading">
                  <Box size={16} />
                  <div>
                    <h3>Appearance</h3>
                    <p>Choose how {selectedRobot.name} is represented in replay and field views.</p>
                  </div>
                </div>

                <SettingRow label="Robot model" description="GLB model used by the 3D field viewer.">
                  <div className="model-select-row">
                    <select
                      className="settings-select model-dropdown"
                      value={activeModel?.id ?? ''}
                      disabled={busy || loading || library.models.length === 0}
                      onChange={(event) => onSelect(selectedRobotId, event.currentTarget.value || null)}
                      aria-label={`${selectedRobot.name} robot model`}
                    >
                      <option value="">{library.models.length === 0 ? 'No model imported' : 'Default placeholder'}</option>
                      {library.models.map((model) => <option value={model.id} key={model.id}>{model.name}</option>)}
                    </select>
                    <button className="secondary-button" type="button" onClick={() => onImport(selectedRobotId)} disabled={busy || loading}>
                      <Upload size={14} />
                      Import GLB
                    </button>
                  </div>
                </SettingRow>

                {loading ? (
                  <div className="model-inline-empty"><span className="model-loading-dot" />Loading saved models…</div>
                ) : activeModel ? (
                  <div className="model-transform">
                    <div className="model-file-summary">
                      <Box size={17} />
                      <span>
                        <strong>{activeModel.name}</strong>
                        <small>{activeModel.sourceFileName} · {formatFileSize(activeModel.sizeBytes)}</small>
                      </span>
                      <button
                        type="button"
                        className="model-delete"
                        disabled={busy}
                        aria-label={`Remove ${activeModel.name}`}
                        title="Remove model"
                        onClick={() => {
                          if (window.confirm(`Remove “${activeModel.name}” from this device?`)) onRemove(activeModel.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="orientation-controls" aria-label={`${activeModel.name} orientation`}>
                      <div className="orientation-group">
                        <span>Rotate 90°</span>
                        <div className="segmented-controls">
                          {AXES.map((axis) => (
                            <button
                              type="button"
                              key={axis}
                              disabled={busy}
                              onClick={() => onUpdateOrientation(activeModel.id, rotate(activeModel.orientation, axis))}
                              title={`Rotate ${axis.toUpperCase()} axis by 90 degrees`}
                            >
                              {axis.toUpperCase()} <small>{activeModel.orientation.rotationDeg[axis]}°</small>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="orientation-group">
                        <span>Flip axis</span>
                        <div className="segmented-controls">
                          {AXES.map((axis) => (
                            <button
                              className={activeModel.orientation.flipped[axis] ? 'pressed' : ''}
                              type="button"
                              key={axis}
                              disabled={busy}
                              aria-pressed={activeModel.orientation.flipped[axis]}
                              onClick={() => onUpdateOrientation(activeModel.id, flip(activeModel.orientation, axis))}
                            >
                              {axis.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        className="reset-orientation"
                        type="button"
                        disabled={busy}
                        onClick={() => onUpdateOrientation(activeModel.id, RESET_ORIENTATION)}
                      >
                        <RotateCcw size={13} /> Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="model-inline-empty">
                    <Box size={18} /> Import an uncompressed glTF 2.0 binary to preview this robot in 3D.
                  </div>
                )}
              </section>

              <section className="settings-group">
                <div className="settings-group-heading">
                  <Gauge size={16} />
                  <div>
                    <h3>Drive simulation</h3>
                    <p>Physical limits and solver values for the {selectedRobot.name} chassis.</p>
                  </div>
                </div>
                <div className="numeric-settings-grid">
                  <label className="numeric-setting">
                    <span>Coefficient of friction <small>CoF</small></span>
                    <div className="number-input"><input type="number" min="0" max="2" step="0.01" value={tuning.coefficientOfFriction} onChange={(event) => updateTuning('coefficientOfFriction', Number(event.currentTarget.value))} /></div>
                  </label>
                  <label className="numeric-setting">
                    <span>Max acceleration</span>
                    <div className="number-input"><input type="number" min="0" step="0.1" value={tuning.maxAcceleration} onChange={(event) => updateTuning('maxAcceleration', Number(event.currentTarget.value))} /><small>m/s²</small></div>
                  </label>
                  <label className="numeric-setting">
                    <span>Max drive speed</span>
                    <div className="number-input"><input type="number" min="0" step="0.1" value={tuning.maxDriveSpeed} onChange={(event) => updateTuning('maxDriveSpeed', Number(event.currentTarget.value))} /><small>m/s</small></div>
                  </label>
                  <label className="numeric-setting">
                    <span>Max angular speed</span>
                    <div className="number-input"><input type="number" min="0" step="10" value={tuning.maxAngularSpeed} onChange={(event) => updateTuning('maxAngularSpeed', Number(event.currentTarget.value))} /><small>°/s</small></div>
                  </label>
                  <label className="numeric-setting">
                    <span>Robot mass</span>
                    <div className="number-input"><input type="number" min="0" step="0.5" value={tuning.robotMass} onChange={(event) => updateTuning('robotMass', Number(event.currentTarget.value))} /><small>kg</small></div>
                  </label>
                  <label className="numeric-setting">
                    <span>Wheel radius</span>
                    <div className="number-input"><input type="number" min="0" step="1" value={tuning.wheelRadius} onChange={(event) => updateTuning('wheelRadius', Number(event.currentTarget.value))} /><small>mm</small></div>
                  </label>
                  <label className="numeric-setting">
                    <span>Control frequency</span>
                    <div className="number-input"><input type="number" min="20" step="10" value={tuning.controlFrequency} onChange={(event) => updateTuning('controlFrequency', Number(event.currentTarget.value))} /><small>Hz</small></div>
                  </label>
                  <label className="numeric-setting">
                    <span>Drive current limit</span>
                    <div className="number-input"><input type="number" min="0" step="1" value={tuning.driveCurrentLimit} onChange={(event) => updateTuning('driveCurrentLimit', Number(event.currentTarget.value))} /><small>A</small></div>
                  </label>
                </div>
                <SettingRow label="Simulate battery sag" description="Reduce available voltage as motor load increases.">
                  <Toggle checked={tuning.simulateBatterySag} label="Simulate battery sag" onChange={(value) => updateTuning('simulateBatterySag', value)} />
                </SettingRow>
                <SettingRow label="Enable collisions" description="Resolve contacts between this robot, the field, and game pieces.">
                  <Toggle checked={tuning.enableCollisions} label="Enable collisions" onChange={(value) => updateTuning('enableCollisions', value)} />
                </SettingRow>
              </section>
            </div>
          ) : page === 'connectivity' ? (
            <div className="settings-page" role="tabpanel">
              <div className="connection-summary">
                <span className="connection-icon"><Network size={18} /></span>
                <div>
                  <strong>{selectedRobot.name} SSH</strong>
                  <span>{connectivity.username}@{connectivity.host}:{connectivity.port}</span>
                </div>
                <span className="connection-state"><i /> Not connected</span>
                <button className="primary-button" type="button" disabled title="SSH testing is not connected to the simulator yet">
                  Test SSH
                </button>
              </div>

              <section className="settings-group">
                <div className="settings-group-heading">
                  <KeyRound size={16} />
                  <div>
                    <h3>SSH connection</h3>
                    <p>Credentials and address used to reach {selectedRobot.name} for deployment and diagnostics.</p>
                  </div>
                </div>
                <SettingRow label="Host" description="Hostname, mDNS name, or IPv4 address.">
                  <input className="settings-input" type="text" value={connectivity.host} spellCheck={false} onChange={(event) => updateConnectivity('host', event.currentTarget.value)} />
                </SettingRow>
                <SettingRow label="SSH port" description="The remote Secure Shell service port.">
                  <div className="number-input compact"><input type="number" min="1" max="65535" value={connectivity.port} onChange={(event) => updateConnectivity('port', Number(event.currentTarget.value))} /></div>
                </SettingRow>
                <SettingRow label="Username" description="Linux account used for the remote session.">
                  <input className="settings-input" type="text" value={connectivity.username} autoComplete="off" onChange={(event) => updateConnectivity('username', event.currentTarget.value)} />
                </SettingRow>
                <SettingRow label="Authentication" description="Use a local SSH key when possible.">
                  <select className="settings-select" value={connectivity.authentication} onChange={(event) => updateConnectivity('authentication', event.currentTarget.value as AuthenticationMethod)}>
                    <option value="key">Private key</option>
                    <option value="password">Password</option>
                  </select>
                </SettingRow>
                {connectivity.authentication === 'key' ? (
                  <SettingRow label="Private key" description="Path to an OpenSSH private key on this computer.">
                    <div className="input-with-icon"><FileKey size={14} /><input type="text" value={connectivity.privateKeyPath} spellCheck={false} onChange={(event) => updateConnectivity('privateKeyPath', event.currentTarget.value)} /></div>
                  </SettingRow>
                ) : (
                  <SettingRow label="Password" description="Kept in memory only and never stored by KnightSim.">
                    <input className="settings-input" type="password" value={connectivity.password} autoComplete="new-password" placeholder="Enter password" onChange={(event) => updateConnectivity('password', event.currentTarget.value)} />
                  </SettingRow>
                )}
              </section>

              <section className="settings-group">
                <div className="settings-group-heading">
                  <ShieldCheck size={16} />
                  <div>
                    <h3>Connection behavior</h3>
                    <p>Timeout, verification, and recovery options for unstable field networks.</p>
                  </div>
                </div>
                <SettingRow label="Connection timeout" description="Stop an SSH attempt after this interval.">
                  <div className="number-input compact"><input type="number" min="1" step="1" value={connectivity.connectTimeout} onChange={(event) => updateConnectivity('connectTimeout', Number(event.currentTarget.value))} /><small>sec</small></div>
                </SettingRow>
                <SettingRow label="Keep-alive interval" description="Send a heartbeat to detect dropped links.">
                  <div className="number-input compact"><input type="number" min="0" step="1" value={connectivity.keepAlive} onChange={(event) => updateConnectivity('keepAlive', Number(event.currentTarget.value))} /><small>sec</small></div>
                </SettingRow>
                <SettingRow label="Automatically reconnect" description="Retry the last robot after an unexpected disconnect.">
                  <Toggle checked={connectivity.autoReconnect} label="Automatically reconnect" onChange={(value) => updateConnectivity('autoReconnect', value)} />
                </SettingRow>
                <SettingRow label="Verify host key" description="Reject a robot if its saved SSH fingerprint changes.">
                  <Toggle checked={connectivity.verifyHostKey} label="Verify host key" onChange={(value) => updateConnectivity('verifyHostKey', value)} />
                </SettingRow>
                <SettingRow label="Enable compression" description="Compress SSH traffic on slower radio links.">
                  <Toggle checked={connectivity.compression} label="Enable compression" onChange={(value) => updateConnectivity('compression', value)} />
                </SettingRow>
              </section>

              <section className="settings-group">
                <div className="settings-group-heading">
                  <Wifi size={16} />
                  <div>
                    <h3>Remote services</h3>
                    <p>Defaults used after the SSH connection is established.</p>
                  </div>
                </div>
                <SettingRow label="Telemetry port" description="TCP port used by the live robot data stream.">
                  <div className="number-input compact"><input type="number" min="1" max="65535" value={connectivity.telemetryPort} onChange={(event) => updateConnectivity('telemetryPort', Number(event.currentTarget.value))} /></div>
                </SettingRow>
                <SettingRow label="Remote workspace" description="Working directory for future deploy and launch commands.">
                  <input className="settings-input" type="text" value={connectivity.remoteWorkspace} spellCheck={false} onChange={(event) => updateConnectivity('remoteWorkspace', event.currentTarget.value)} />
                </SettingRow>
              </section>
            </div>
          ) : (
            <div className="settings-page" role="tabpanel">
              <section className="settings-group">
                <div className="settings-group-heading">
                  <Keyboard size={16} />
                  <div>
                    <h3>Navigation</h3>
                    <p>Keyboard shortcuts for moving around the KnightSim workspace.</p>
                  </div>
                </div>
                <div className="keybinding-row">
                  <div className="keybinding-copy">
                    <strong>Toggle sidebar</strong>
                    <span>Switch the left sidebar between its narrow rail and last expanded width.</span>
                  </div>
                  <div className="keybinding-keys" aria-label="Control plus B">
                    <kbd>Ctrl</kbd>
                    <span>+</span>
                    <kbd>B</kbd>
                  </div>
                </div>
                <div className="keybinding-row">
                  <div className="keybinding-copy">
                    <strong>Toggle field overlays</strong>
                    <span>Open or collapse the field-overlay sidebar in 2D and 3D views.</span>
                  </div>
                  <div className="keybinding-keys" aria-label={`Control plus ${window.knightSim?.platform === 'darwin' ? 'Option' : 'Alt'} plus B`}>
                    <kbd>Ctrl</kbd>
                    <span>+</span>
                    <kbd>{window.knightSim?.platform === 'darwin' ? 'Option' : 'Alt'}</kbd>
                    <span>+</span>
                    <kbd>B</kbd>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
