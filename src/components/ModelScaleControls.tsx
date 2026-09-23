import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { configureDracoLoader } from '../loaders/draco';
import { modelDimensions } from '../loaders/modelDimensions';
import type { RobotModelOrientation, RobotModelRecord } from '../types';

class SizeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    return this.state.failed ? <span>Model size unavailable — the model could not be loaded.</span> : this.props.children;
  }
}

function ModelSize({ model }: { model: RobotModelRecord }) {
  const url = window.knightSim!.robotModels.urlFor(model.id);
  const { scene } = useGLTF(url, false, true, configureDracoLoader);
  const size = useMemo(() => modelDimensions(scene, model.orientation), [scene, model.orientation]);
  const format = (value: number) => value.toLocaleString(undefined, { maximumSignificantDigits: 4 });
  return <span>Current size (X × Y × Z): <strong>{format(size.x)} × {format(size.y)} × {format(size.z)} m</strong></span>;
}

export function ModelScaleControls({ model, busy, onUpdate }: {
  model: RobotModelRecord;
  busy: boolean;
  onUpdate: (id: string, orientation: RobotModelOrientation) => void;
}) {
  const [draft, setDraft] = useState(String(model.orientation.scale ?? 1));
  useEffect(() => setDraft(String(model.orientation.scale ?? 1)), [model.orientation.scale]);
  const value = Number(draft);
  const valid = draft.trim() !== '' && Number.isFinite(value) && value > 0;
  const save = (scale: number) => {
    setDraft(String(scale));
    onUpdate(model.id, { ...model.orientation, scale });
  };
  return <div className="model-scale-controls">
    <form className="model-scale-row" onSubmit={(event) => { event.preventDefault(); if (valid) save(value); }}>
      <label htmlFor={`scale-${model.id}`}>Scale</label>
      <input id={`scale-${model.id}`} type="number" step="any" min="0" value={draft}
        disabled={busy} aria-invalid={!valid} aria-describedby={`scale-help-${model.id}`}
        onChange={(event) => setDraft(event.currentTarget.value)} />
      <button className="secondary-button" disabled={busy || !valid || value === (model.orientation.scale ?? 1)}>Apply</button>
      <button className="secondary-button" type="button" disabled={busy} onClick={() => save(0.001)}>mm → m (0.001×)</button>
      <button className="secondary-button" type="button" disabled={busy} onClick={() => save(1)}>Reset 1×</button>
    </form>
    <small id={`scale-help-${model.id}`}>{valid ? 'Uniform multiplier on all axes. Use 0.001 for models exported in millimetres.' : 'Enter a finite scale greater than zero.'}</small>
    <div className="model-current-size" aria-live="polite">
      <SizeBoundary key={model.id}><Suspense fallback={<span>Measuring model…</span>}>
        {window.knightSim?.robotModels ? <ModelSize model={model} /> : <span>Model size is available in the desktop app.</span>}
      </Suspense></SizeBoundary>
    </div>
  </div>;
}
