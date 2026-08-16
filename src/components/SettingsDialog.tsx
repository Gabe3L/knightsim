import { Box, Check, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { useEffect } from 'react';
import type { ModelAxis, RobotModelLibrary, RobotModelOrientation } from '../types';

interface SettingsDialogProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly library: RobotModelLibrary;
  readonly loading: boolean;
  readonly onClearError: () => void;
  readonly onClose: () => void;
  readonly onImport: () => void;
  readonly onRemove: (id: string) => void;
  readonly onSelect: (id: string) => void;
  readonly onUpdateOrientation: (id: string, orientation: RobotModelOrientation) => void;
}

const AXES: readonly ModelAxis[] = ['x', 'y', 'z'];

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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <span className="eyebrow">KNIGHTSIM</span>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        <div className="settings-content">
          <div className="settings-section-heading">
            <div>
              <h3>Robot models</h3>
              <p>Private GLB files stored in this operating system user’s KnightSim data.</p>
            </div>
            <button className="primary-button" type="button" onClick={onImport} disabled={busy || loading}>
              <Upload size={15} />
              Import GLB
            </button>
          </div>

          {error ? (
            <div className="settings-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={onClearError} aria-label="Dismiss error"><X size={14} /></button>
            </div>
          ) : null}

          {loading ? (
            <div className="model-empty"><span className="model-loading-dot" />Loading saved models…</div>
          ) : library.models.length === 0 ? (
            <div className="model-empty">
              <Box size={30} />
              <strong>No robot model uploaded</strong>
              <span>Export an uncompressed glTF 2.0 binary from Onshape, then import the .glb file here.</span>
            </div>
          ) : (
            <div className="model-list">
              {library.models.map((model) => {
                const selected = model.id === library.activeModelId;
                return (
                  <article className={selected ? 'model-card selected' : 'model-card'} key={model.id}>
                    <div className="model-card-main">
                      <button
                        className="model-select"
                        type="button"
                        disabled={busy}
                        onClick={() => onSelect(model.id)}
                        aria-pressed={selected}
                      >
                        <span className="model-radio">{selected ? <Check size={13} /> : null}</span>
                        <span className="model-copy">
                          <strong>{model.name}</strong>
                          <small>{model.sourceFileName} · {formatFileSize(model.sizeBytes)}</small>
                        </span>
                        {selected ? <span className="model-active-label">Active</span> : null}
                      </button>
                      <button
                        className="model-delete"
                        type="button"
                        disabled={busy}
                        aria-label={`Remove ${model.name}`}
                        title="Remove model"
                        onClick={() => {
                          if (window.confirm(`Remove “${model.name}” from this device?`)) onRemove(model.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="orientation-controls" aria-label={`${model.name} orientation`}>
                      <div className="orientation-group">
                        <span>Rotate 90°</span>
                        <div className="segmented-controls">
                          {AXES.map((axis) => (
                            <button
                              type="button"
                              key={axis}
                              disabled={busy}
                              onClick={() => onUpdateOrientation(model.id, rotate(model.orientation, axis))}
                              title={`Rotate ${axis.toUpperCase()} axis by 90 degrees`}
                            >
                              {axis.toUpperCase()} <small>{model.orientation.rotationDeg[axis]}°</small>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="orientation-group">
                        <span>Flip</span>
                        <div className="segmented-controls">
                          {AXES.map((axis) => (
                            <button
                              className={model.orientation.flipped[axis] ? 'pressed' : ''}
                              type="button"
                              key={axis}
                              disabled={busy}
                              aria-pressed={model.orientation.flipped[axis]}
                              onClick={() => onUpdateOrientation(model.id, flip(model.orientation, axis))}
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
                        onClick={() => onUpdateOrientation(model.id, RESET_ORIENTATION)}
                      >
                        <RotateCcw size={13} /> Reset
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
