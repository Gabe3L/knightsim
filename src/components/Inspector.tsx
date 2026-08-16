import { useMemo, useState, type DragEvent } from 'react';
import {
  Bot,
  ChevronRight,
  Gauge,
  GripVertical,
} from 'lucide-react';
import {
  GRAPH_SIGNAL_DRAG_TYPE,
  graphSignalById,
  graphSignalValueAt,
} from '../telemetry/graphSignals';
import type { RobotTelemetry } from '../types';

interface InspectorProps {
  readonly robot: RobotTelemetry;
  readonly currentTimeS: number;
  readonly collapsed?: boolean;
}

interface TelemetryField {
  readonly label: string;
  readonly value: string;
  readonly graphSignalId?: string;
}

interface TelemetryTopic {
  readonly id: string;
  readonly label: string;
  readonly fields: readonly TelemetryField[];
}

interface RobotNode {
  readonly id: string;
  readonly name: string;
  readonly connected: boolean;
  readonly topics: readonly TelemetryTopic[];
}

interface RobotSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly heat: number;
  readonly maxHeat: number;
  readonly battery: string;
  readonly signal: string;
  readonly mode: string;
  readonly cpu: string;
  readonly aimTarget: string;
  readonly yawError: string;
  readonly pitchError: string;
  readonly aimLocked: boolean;
}

function graphField(
  label: string,
  graphSignalId: string,
  timeS: number,
  displayValue?: string,
): TelemetryField {
  const descriptor = graphSignalById(graphSignalId);
  const value = graphSignalValueAt(graphSignalId, timeS);
  return {
    label,
    value: displayValue ?? (descriptor && value !== null ? descriptor.format(value) : '—'),
    graphSignalId: descriptor ? graphSignalId : undefined,
  };
}

function topicsFor(snapshot: RobotSnapshot, robotId: string, timeS: number): readonly TelemetryTopic[] {
  return [
    {
      id: 'pose',
      label: 'Pose',
      fields: [
        graphField('X', `${robotId}.pose.x`, timeS),
        graphField('Y', `${robotId}.pose.y`, timeS),
        graphField('Z', `${robotId}.pose.z`, timeS),
        graphField('Yaw', `${robotId}.pose.yaw`, timeS),
        graphField('Pitch', `${robotId}.pose.pitch`, timeS),
        graphField('Roll', `${robotId}.pose.roll`, timeS),
      ],
    },
    {
      id: 'referee',
      label: 'Referee state',
      fields: [
        graphField('Hit points', `${robotId}.referee.hp`, timeS, `${snapshot.hp} / ${snapshot.maxHp}`),
        graphField('Barrel heat', `${robotId}.referee.heat`, timeS, `${snapshot.heat} / ${snapshot.maxHeat}`),
        { label: 'Team', value: 'Red' },
        { label: 'Match stage', value: 'Battle' },
      ],
    },
    {
      id: 'systems',
      label: 'Systems',
      fields: [
        snapshot.battery === '—'
          ? { label: 'Battery', value: snapshot.battery }
          : graphField('Battery', `${robotId}.systems.battery`, timeS),
        snapshot.signal === 'No link'
          ? { label: 'Signal', value: snapshot.signal }
          : graphField('Signal', `${robotId}.systems.signal`, timeS),
        { label: 'Drive mode', value: snapshot.mode },
        snapshot.cpu === '—'
          ? { label: 'CPU load', value: snapshot.cpu }
          : graphField('CPU load', `${robotId}.systems.cpu`, timeS),
      ],
    },
    {
      id: 'aim',
      label: 'Aim',
      fields: [
        { label: 'Target', value: snapshot.aimTarget },
        snapshot.yawError === '—'
          ? { label: 'Yaw error', value: snapshot.yawError }
          : graphField('Yaw error', `${robotId}.aim.yaw-error`, timeS),
        snapshot.pitchError === '—'
          ? { label: 'Pitch error', value: snapshot.pitchError }
          : graphField('Pitch error', `${robotId}.aim.pitch-error`, timeS),
        { label: 'Locked', value: snapshot.aimLocked ? 'Yes' : 'No' },
      ],
    },
  ];
}

function toggleKey(current: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function Inspector({ robot, currentTimeS, collapsed = false }: InspectorProps) {
  const [expandedRobots, setExpandedRobots] = useState<ReadonlySet<string>>(() => new Set(['infantry']));
  const [expandedTopics, setExpandedTopics] = useState<ReadonlySet<string>>(() => new Set(['infantry:pose']));

  const robots = useMemo<readonly RobotNode[]>(() => [
    {
      id: 'sentry',
      name: 'Sentry',
      connected: false,
      topics: topicsFor({
        x: 2.184, y: 6.932, z: 0, yaw: -90, pitch: 0, roll: 0,
        hp: 600, maxHp: 600, heat: 0, maxHeat: 400,
        battery: '—', signal: 'No link', mode: 'Idle', cpu: '—',
        aimTarget: 'None', yawError: '—', pitchError: '—', aimLocked: false,
      }, 'sentry', currentTimeS),
    },
    {
      id: 'infantry',
      name: 'Infantry',
      connected: robot.connected,
      topics: topicsFor({
        x: robot.xM, y: robot.yM, z: 0, yaw: robot.yawDeg, pitch: -1.4, roll: 0.2,
        hp: robot.hp, maxHp: robot.maxHp, heat: robot.heat, maxHeat: robot.maxHeat,
        battery: '23.8 V', signal: '-47 dBm', mode: 'Chassis follow', cpu: '38%',
        aimTarget: 'Blue-03', yawError: '0.8°', pitchError: '-0.3°', aimLocked: true,
      }, 'infantry', currentTimeS),
    },
    {
      id: 'hero',
      name: 'Hero',
      connected: false,
      topics: topicsFor({
        x: 8.642, y: 1.207, z: 0, yaw: 176.4, pitch: 0, roll: -0.1,
        hp: 300, maxHp: 300, heat: 18, maxHeat: 200,
        battery: '—', signal: 'No link', mode: 'Safe', cpu: '—',
        aimTarget: 'None', yawError: '—', pitchError: '—', aimLocked: false,
      }, 'hero', currentTimeS),
    },
  ], [currentTimeS, robot]);

  const startSignalDrag = (event: DragEvent<HTMLDivElement>, graphSignalId: string): void => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(GRAPH_SIGNAL_DRAG_TYPE, graphSignalId);
    event.dataTransfer.setData('text/plain', graphSignalId);
  };

  if (collapsed) {
    return (
      <div className="inspector inspector-collapsed" aria-label="Robots">
        {robots.map((item) => (
          <button className="rail-tool" type="button" aria-label={`${item.name}, ${item.connected ? 'online' : 'offline'}`} title={`${item.name} · ${item.connected ? 'Online' : 'Offline'}`} key={item.id}>
            {item.id === 'infantry' ? <Gauge size={19} /> : <Bot size={18} />}
            <span className={item.connected ? 'rail-status online' : 'rail-status offline'} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="inspector">
      <div className="telemetry-tree">
        {robots.map((item) => {
          const robotExpanded = expandedRobots.has(item.id);
          return (
            <section className={robotExpanded ? 'robot-node expanded' : 'robot-node'} key={item.id}>
              <button
                className="robot-node-toggle"
                type="button"
                aria-expanded={robotExpanded}
                aria-controls={`${item.id}-topics`}
                onClick={() => setExpandedRobots((current) => toggleKey(current, item.id))}
              >
                <ChevronRight className="tree-chevron" size={15} />
                <span className="robot-node-copy">
                  <strong>{item.name}</strong>
                </span>
                <span className={item.connected ? 'tree-status online' : 'tree-status offline'}>
                  <i />{item.connected ? 'Online' : 'Offline'}
                </span>
              </button>

              {robotExpanded ? (
                <div className="topic-list" id={`${item.id}-topics`}>
                  {item.topics.map((topic) => {
                    const topicKey = `${item.id}:${topic.id}`;
                    const topicExpanded = expandedTopics.has(topicKey);
                    return (
                      <div className={topicExpanded ? 'topic-node expanded' : 'topic-node'} key={topic.id}>
                        <button
                          className="topic-node-toggle"
                          type="button"
                          aria-expanded={topicExpanded}
                          aria-controls={`${item.id}-${topic.id}-fields`}
                          onClick={() => setExpandedTopics((current) => toggleKey(current, topicKey))}
                        >
                          <ChevronRight className="tree-chevron" size={14} />
                          <span>{topic.label}</span>
                        </button>

                        {topicExpanded ? (
                          <dl className="telemetry-fields" id={`${item.id}-${topic.id}-fields`}>
                            {topic.fields.map((field) => (
                              <div
                                className={field.graphSignalId ? 'telemetry-field telemetry-field-draggable' : 'telemetry-field'}
                                draggable={Boolean(field.graphSignalId)}
                                key={field.label}
                                title={field.graphSignalId ? 'Drag onto Line Graph' : undefined}
                                onDragStart={field.graphSignalId ? (event) => startSignalDrag(event, field.graphSignalId!) : undefined}
                              >
                                <span className="field-branch">
                                  {field.graphSignalId ? <GripVertical size={11} /> : '—'}
                                </span>
                                <dt>{field.label}</dt>
                                <dd>{field.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
