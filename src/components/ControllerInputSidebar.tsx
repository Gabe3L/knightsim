import { Gamepad2, MousePointer2, Trash2, X } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import {
  CONTROLLER_INPUT_DRAG_TYPE,
  controllerInputById,
  readControllerInputDragId,
  type ControllerInputDescriptor,
} from '../telemetry/controllerInputs';

interface ControllerInputSidebarProps {
  readonly currentTimeS: number;
  readonly inputIds: readonly string[];
  readonly onAdd: (id: string) => void;
  readonly onClear: () => void;
  readonly onRemove: (id: string) => void;
}

export function ControllerInputSidebar({
  currentTimeS,
  inputIds,
  onAdd,
  onClear,
  onRemove,
}: ControllerInputSidebarProps) {
  const [dropActive, setDropActive] = useState(false);
  const inputs = useMemo(() => inputIds
    .map(controllerInputById)
    .filter((input): input is ControllerInputDescriptor => Boolean(input)), [inputIds]);

  const supportsDrag = (event: DragEvent<HTMLElement>): boolean => (
    Array.from(event.dataTransfer.types).includes(CONTROLLER_INPUT_DRAG_TYPE)
  );

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!supportsDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDropActive(false);
    const id = readControllerInputDragId(event.dataTransfer);
    if (id) onAdd(id);
  };

  return (
    <aside
      className={dropActive ? 'controller-input-sidebar controller-input-sidebar-drop-active' : 'controller-input-sidebar'}
      aria-label="Controller inputs"
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="controller-input-sidebar-header">
        <span className="controller-input-sidebar-icon"><Gamepad2 size={16} /></span>
        <span className="controller-input-sidebar-title">
          <strong>Controller inputs</strong>
          <small>{inputs.length} of 13 mapped</small>
        </span>
      </header>

      <div className="controller-input-sidebar-toolbar">
        <span><MousePointer2 size={12} /> Drop inputs here</span>
        <button type="button" disabled={inputs.length === 0} onClick={onClear} title="Remove all mapped inputs">
          <Trash2 size={12} /> Clear
        </button>
      </div>

      <div className="controller-input-list" aria-live="polite">
        {inputs.length === 0 ? (
          <div className="controller-input-empty">
            <span><Gamepad2 size={23} /></span>
            <strong>Nothing mapped yet</strong>
            <p>Drag channels from any robot’s Inputs folder and drop them anywhere in this panel.</p>
          </div>
        ) : inputs.map((input) => {
          const value = input.sampleAt(currentTimeS);
          const active = input.kind === 'axis' ? Math.abs(value) > 0.06 : input.kind === 'switch' || value >= 0.5;
          return (
            <div
              className={[
                'controller-input-row',
                `controller-input-row-${input.robotId}`,
                active && 'controller-input-row-active',
              ].filter(Boolean).join(' ')}
              key={input.id}
            >
              <i />
              <span className="controller-input-row-copy">
                <strong>{input.label}</strong>
                <small>{input.robotName} · {input.kind}</small>
              </span>
              <span className="controller-input-value">{input.format(value)}</span>
              <button type="button" onClick={() => onRemove(input.id)} aria-label={`Remove ${input.label}`} title="Remove input">
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {dropActive ? (
        <div className="controller-input-drop-message" aria-hidden="true">
          <Gamepad2 size={19} /> Drop to map input
        </div>
      ) : null}
    </aside>
  );
}
