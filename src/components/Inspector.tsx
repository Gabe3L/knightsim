import { Activity, Flame, Gauge, HeartPulse, Radio, RotateCw } from 'lucide-react';
import type { RobotTelemetry } from '../types';

interface InspectorProps {
  readonly robot: RobotTelemetry;
  readonly collapsed?: boolean;
}

function MetricRow({
  icon,
  label,
  value,
  subvalue,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly subvalue?: string;
}) {
  return (
    <div className="metric-row">
      <div className="metric-icon">{icon}</div>
      <div className="min-w-0">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
      </div>
      {subvalue ? <span className="metric-subvalue">{subvalue}</span> : null}
    </div>
  );
}

function Bar({ value, max, color }: { readonly value: number; readonly max: number; readonly color: string }) {
  const width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  return (
    <div className="value-bar">
      <span style={{ width, backgroundColor: color }} />
    </div>
  );
}

export function Inspector({ robot, collapsed = false }: InspectorProps) {
  if (collapsed) {
    return (
      <div className="inspector inspector-collapsed" aria-label="Robot inspector">
        <button className="rail-tool rail-tool-active" type="button" aria-label="Selected robot" title="Selected robot">
          <Gauge size={19} />
          <span className={robot.connected ? 'rail-status online' : 'rail-status offline'} />
        </button>
        <button className="rail-tool" type="button" aria-label="Pose telemetry" title="Pose telemetry">
          <Activity size={18} />
        </button>
        <button className="rail-tool" type="button" aria-label="Referee state" title="Referee state">
          <Radio size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="inspector">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SELECTED ASSET</span>
          <h2>RED-01 · Infantry</h2>
        </div>
        <div className={robot.connected ? 'connection-dot online' : 'connection-dot offline'} />
      </div>

      <div className="robot-card">
        <div className="robot-avatar"><Gauge size={24} /></div>
        <div>
          <div className="robot-name">Mock robot</div>
          <div className="robot-id">NT:/robots/red-01</div>
        </div>
        <span className={robot.connected ? 'status-chip connected' : 'status-chip disconnected'}>
          {robot.connected ? 'CONNECTED' : 'DROPPED'}
        </span>
      </div>

      <section className="inspector-section">
        <h3><Activity size={14} /> Pose</h3>
        <div className="metric-stack">
          <MetricRow icon={<span className="axis axis-x">X</span>} label="FIELD X" value={`${robot.xM.toFixed(3)} m`} />
          <MetricRow icon={<span className="axis axis-y">Y</span>} label="FIELD Y" value={`${robot.yM.toFixed(3)} m`} />
          <MetricRow icon={<RotateCw size={15} />} label="YAW" value={`${robot.yawDeg.toFixed(1)}°`} subvalue="CCW+" />
        </div>
      </section>

      <section className="inspector-section">
        <h3><Radio size={14} /> Referee state</h3>
        <div className="vital-card">
          <div className="vital-header">
            <span><HeartPulse size={14} /> HIT POINTS</span>
            <strong>{robot.hp} <small>/ {robot.maxHp}</small></strong>
          </div>
          <Bar value={robot.hp} max={robot.maxHp} color="#46e7b2" />
        </div>
        <div className="vital-card">
          <div className="vital-header">
            <span><Flame size={14} /> BARREL HEAT</span>
            <strong>{robot.heat} <small>/ {robot.maxHeat}</small></strong>
          </div>
          <Bar value={robot.heat} max={robot.maxHeat} color="#ffb34d" />
        </div>
      </section>

      <div className="inspector-footer">
        <span>Move with</span>
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
        <span>Rotate</span><kbd>Q</kbd><kbd>E</kbd>
      </div>
    </div>
  );
}
