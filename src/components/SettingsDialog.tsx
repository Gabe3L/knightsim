import { ROBOT_PROFILES } from '../robots/profiles';
import {
  Bot,
  Box,
  Crosshair,
  FileKey,
  FolderOpen,
  Keyboard,
  KeyRound,
  Network,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Wifi,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { FIELD_CAMERA_KEYBINDINGS, REPLAY_KEYBINDINGS } from '../keybindings';
import type { ModelAxis, RobotId, RobotModelLibrary, RobotModelOrientation } from '../types';
import '../styles/settings.css';
import { ModelScaleControls } from './ModelScaleControls';
import { RobotModelPreview } from './RobotModelPreview';

interface SettingsDialogProps {
  readonly initialRobotId: RobotId;
  readonly busy: boolean;
  readonly error: string | null;
  readonly library: RobotModelLibrary;
  readonly loading: boolean;
  readonly modelsAvailable: boolean;
  readonly onClearError: () => void;
  readonly onClose: () => void;
  readonly onChooseDirectory: () => void;
  readonly onResetDirectory: () => void;
  readonly onRefreshModels: () => void;
  readonly onSelect: (robotId: RobotId, id: string | null) => void;
  readonly onUpdateOrientation: (id: string, orientation: RobotModelOrientation) => void;
}

type SettingsPage = 'settings' | 'connectivity' | 'keybindings';
type AuthenticationMethod = 'key' | 'password';

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

const ROBOTS = ROBOT_PROFILES;

const DEFAULT_CONNECTIVITY: Record<RobotId, ConnectivitySettings> = Object.fromEntries(ROBOTS.map(({ id }) => [id, {
  host: `${id}.local`, port: 22, username: 'ubuntu', authentication: 'key',
  privateKeyPath: '~/.ssh/id_ed25519', password: '', connectTimeout: 8, keepAlive: 15,
  autoReconnect: true, verifyHostKey: true, compression: false, telemetryPort: 5800,
  remoteWorkspace: '/home/ubuntu/knightsim',
}]));

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
  scale: 1,
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
  initialRobotId,
  busy,
  error,
  library,
  loading,
  modelsAvailable,
  onClearError,
  onClose,
  onChooseDirectory,
  onResetDirectory,
  onRefreshModels,
  onSelect,
  onUpdateOrientation,
}: SettingsDialogProps) {
  const [page, setPage] = useState<SettingsPage>('settings');
  const [selectedRobotId, setSelectedRobotId] = useState<RobotId>(initialRobotId);
  const [connectivityByRobot, setConnectivityByRobot] = useState(() => (
    loadSettings(CONNECTIVITY_STORAGE_KEY, DEFAULT_CONNECTIVITY)
  ));

  const selectedRobot = ROBOTS.find((robot) => robot.id === selectedRobotId) ?? ROBOTS[1]!;
  const connectivity = connectivityByRobot[selectedRobotId]!;
  const activeModel = library.models.find(
    (model) => model.id === library.modelIdByRobot[selectedRobotId],
  ) ?? null;

  useEffect(() => {
    const nonSecretSettings = Object.fromEntries(ROBOTS.map(({ id }) => {
      const { password: _password, ...safeSettings } = connectivityByRobot[id]!;
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

  const updateConnectivity = <K extends keyof ConnectivitySettings>(
    key: K,
    value: ConnectivitySettings[K],
  ): void => {
    setConnectivityByRobot((current) => ({
      ...current,
      [selectedRobotId]: { ...current[selectedRobotId]!, [key]: value },
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
                <span>Select robot</span>
                <small>Settings are separate for each robot.</small>
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
                    <strong>{robot.name}</strong>
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
                    <p>{selectedRobot.name} · A black cube labeled with the robot name appears when no model is selected.</p>
                  </div>
                </div>

                <div className="model-folder">
                  <div className="model-folder-copy">
                    <strong>Model folder</strong>
                    <span>Load GLB files directly from this folder. Default: ./models</span>
                  </div>
                  <div className="model-folder-path" title={library.directory}>
                    <FolderOpen size={16} />
                    <span>{library.directory}</span>
                  </div>
                  <div className="model-folder-actions">
                    <button className="secondary-button" type="button" onClick={onChooseDirectory} disabled={!modelsAvailable || busy || loading}>
                      <FolderOpen size={14} /> Choose folder
                    </button>
                    <button className="secondary-button" type="button" onClick={onRefreshModels} disabled={!modelsAvailable || busy || loading}>
                      <RefreshCw size={14} /> Refresh
                    </button>
                    <button className="secondary-button" type="button" onClick={onResetDirectory} disabled={!modelsAvailable || busy || loading || library.isDefaultDirectory}>
                      <RotateCcw size={14} /> Use ./models
                    </button>
                  </div>
                  {!modelsAvailable ? <span role="status">Open the KnightSim desktop app to choose a model folder.</span> : null}
                  {library.directoryMissing ? <span role="status">This folder is unavailable. Choose another folder or restore it, then Refresh.</span> : null}
                  {library.issues.length > 0 ? (
                    <div className="model-folder-issues" role="status">
                      <strong>Some files could not be loaded:</strong>
                      <ul>{library.issues.map((issue) => <li key={issue.fileName}>{issue.fileName}: {issue.message}</li>)}</ul>
                    </div>
                  ) : null}
                </div>

                <SettingRow label="Robot model" description="Choose a GLB from the model folder for this robot.">
                  <select
                    className="settings-select model-dropdown"
                    value={activeModel?.id ?? ''}
                    disabled={busy || loading || library.models.length === 0}
                    onChange={(event) => onSelect(selectedRobotId, event.currentTarget.value || null)}
                    aria-label={`${selectedRobot.name} robot model`}
                  >
                    <option value="">Black cube ({selectedRobot.name})</option>
                    {library.models.map((model) => <option value={model.id} key={model.id}>{model.name}</option>)}
                  </select>
                </SettingRow>

                {loading ? (
                  <div className="model-inline-empty"><span className="model-loading-dot" />Loading models from folder…</div>
                ) : (
                  <div className="model-workspace">
                    <RobotModelPreview robotId={selectedRobotId} model={activeModel} />
                    {activeModel ? (
                      <div className="model-transform">
                        <div className="model-file-summary">
                          <Box size={17} />
                          <span>
                            <strong>{activeModel.name}</strong>
                            <small>{activeModel.sourceFileName} · {formatFileSize(activeModel.sizeBytes)}</small>
                          </span>
                        </div>
                        <ModelScaleControls key={activeModel.id} model={activeModel} busy={busy} onUpdate={onUpdateOrientation} />
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
                                  aria-label={`Flip ${axis.toUpperCase()} axis`}
                                  onClick={() => onUpdateOrientation(activeModel.id, flip(activeModel.orientation, axis))}
                                >
                                  {axis.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            className="reset-orientation"
                            title="Reset rotation and flips (keep scale)"
                            type="button"
                            disabled={busy}
                            onClick={() => onUpdateOrientation(activeModel.id, { ...RESET_ORIENTATION, scale: activeModel.orientation.scale })}
                          >
                            <RotateCcw size={13} /> Reset
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="model-inline-empty">
                        <Box size={18} /> {library.models.length === 0
                          ? 'No GLB models found. Add .glb files to the model folder, then Refresh.'
                          : 'Select a model to preview it here and on the Field.'}
                      </div>
                    )}
                  </div>
                )}
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
                    <p>Credentials and address used to reach the {selectedRobot.name} robot.</p>
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
                <SettingRow label="Authentication" description="Use a private key when possible.">
                  <select className="settings-select" value={connectivity.authentication} onChange={(event) => updateConnectivity('authentication', event.currentTarget.value as AuthenticationMethod)}>
                    <option value="key">Private key</option>
                    <option value="password">Password</option>
                  </select>
                </SettingRow>
                {connectivity.authentication === 'key' ? (
                  <SettingRow label="Private key" description="Path to a private key on this computer.">
                    <div className="input-with-icon"><FileKey size={14} /><input type="text" value={connectivity.privateKeyPath} spellCheck={false} onChange={(event) => updateConnectivity('privateKeyPath', event.currentTarget.value)} /></div>
                  </SettingRow>
                ) : (
                  <SettingRow label="Password" description="Password is not stored by KnightSim.">
                    <input className="settings-input" type="password" value={connectivity.password} autoComplete="new-password" placeholder="Enter password" onChange={(event) => updateConnectivity('password', event.currentTarget.value)} />
                  </SettingRow>
                )}
              </section>

              <section className="settings-group">
                <div className="settings-group-heading">
                  <ShieldCheck size={16} />
                  <div>
                    <h3>Connection behavior</h3>
                    <p>Timeout, verification, and recovery options for unstable connections.</p>
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
                    <p>Shortcuts for navigating the workspace.</p>
                  </div>
                </div>
                <div className="keybinding-row">
                  <div className="keybinding-copy">
                    <strong>Toggle left sidebar</strong>
                    <span>Switch the left sidebar between its narrow rail and last expanded width.</span>
                  </div>
                  <div className="keybinding-keys" aria-label={`${window.knightSim?.platform === 'darwin' ? 'Command' : 'Control'} plus B`}>
                    <kbd>{window.knightSim?.platform === 'darwin' ? 'Command' : 'Ctrl'}</kbd>
                    <span>+</span>
                    <kbd>B</kbd>
                  </div>
                </div>
              </section>
              <section className="settings-group">
                <div className="settings-group-heading">
                  <Keyboard size={16} />
                  <div>
                    <h3>Play bar</h3>
                    <p>Arrow keys and Space control replay throughout the workspace. Shortcuts pause while Preferences are open.</p>
                  </div>
                </div>
                {REPLAY_KEYBINDINGS.map((binding) => (
                  <div className="keybinding-row" key={binding.action}>
                    <div className="keybinding-copy">
                      <strong>{binding.label}</strong>
                      <span>{binding.description}</span>
                    </div>
                    <div className="keybinding-keys" aria-label={binding.codes.join(' or ')}>
                      {binding.keys.map((key) => <kbd key={key}>{key}</kbd>)}
                    </div>
                  </div>
                ))}
              </section>
              <section className="settings-group">
                <div className="settings-group-heading">
                  <Crosshair size={16} />
                  <div>
                    <h3>Field camera</h3>
                    <p>Drag to look, scroll to fly forward or back, and Shift-drag or middle-drag to pan. Movement is independent of the field.</p>
                  </div>
                </div>
                {FIELD_CAMERA_KEYBINDINGS.map((binding) => (
                  <div className="keybinding-row" key={binding.action}>
                    <div className="keybinding-copy">
                      <strong>{binding.label}</strong>
                      <span>{binding.description}</span>
                    </div>
                    <div className="keybinding-keys" aria-label={binding.key}>
                      <kbd>{binding.key}</kbd>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
