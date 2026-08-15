import { useMemo, useState } from 'react';
import {
  Bot,
  ChevronRight,
  Gauge,
} from 'lucide-react';
import type { RobotTelemetry } from '../types';

interface InspectorProps {
  readonly robot: RobotTelemetry;
  readonly collapsed?: boolean;
}

interface TelemetryField {
  readonly label: string;
  readonly value: string;
}

interface TelemetryTopic {
  readonly id: string;
  readonly label: string;
  readonly fields: readonly TelemetryField[];
}

interface RobotNode {
  readonly id: string;
  readonly name: string;
  readonly role: string;
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

const formatMeters = (value: number): string => `${value.toFixed(3)} m`;
const formatDegrees = (value: number): string => `${value.toFixed(1)}°`;

function topicsFor(snapshot: RobotSnapshot): readonly TelemetryTopic[] {
  return [
    {
      id: 'pose',
      label: 'Pose',
      fields: [
        { label: 'X', value: formatMeters(snapshot.x) },
        { label: 'Y', value: formatMeters(snapshot.y) },
        { label: 'Z', value: formatMeters(snapshot.z) },
        { label: 'Yaw', value: formatDegrees(snapshot.yaw) },
        { label: 'Pitch', value: formatDegrees(snapshot.pitch) },
        { label: 'Roll', value: formatDegrees(snapshot.roll) },
      ],
    },
    {
      id: 'referee',
      label: 'Referee state',
      fields: [
        { label: 'Hit points', value: `${snapshot.hp} / ${snapshot.maxHp}` },
        { label: 'Barrel heat', value: `${snapshot.heat} / ${snapshot.maxHeat}` },
        { label: 'Team', value: 'Red' },
        { label: 'Match stage', value: 'Battle' },
      ],
    },
    {
      id: 'systems',
      label: 'Systems',
      fields: [
        { label: 'Battery', value: snapshot.battery },
        { label: 'Signal', value: snapshot.signal },
        { label: 'Drive mode', value: snapshot.mode },
        { label: 'CPU load', value: snapshot.cpu },
      ],
    },
    {
      id: 'aim',
      label: 'Aim',
      fields: [
        { label: 'Target', value: snapshot.aimTarget },
        { label: 'Yaw error', value: snapshot.yawError },
        { label: 'Pitch error', value: snapshot.pitchError },
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

export function Inspector({ robot, collapsed = false }: InspectorProps) {
  const [expandedRobots, setExpandedRobots] = useState<ReadonlySet<string>>(() => new Set(['infantry']));
  const [expandedTopics, setExpandedTopics] = useState<ReadonlySet<string>>(() => new Set(['infantry:pose']));

  const robots = useMemo<readonly RobotNode[]>(() => [
    {
      id: 'sentry',
      name: 'Sentry',
      role: 'RED-07',
      connected: false,
      topics: topicsFor({
        x: 2.184, y: 6.932, z: 0, yaw: -90, pitch: 0, roll: 0,
        hp: 600, maxHp: 600, heat: 0, maxHeat: 400,
        battery: '—', signal: 'No link', mode: 'Idle', cpu: '—',
        aimTarget: 'None', yawError: '—', pitchError: '—', aimLocked: false,
      }),
    },
    {
      id: 'infantry',
      name: 'Infantry',
      role: 'RED-01',
      connected: robot.connected,
      topics: topicsFor({
        x: robot.xM, y: robot.yM, z: 0, yaw: robot.yawDeg, pitch: -1.4, roll: 0.2,
        hp: robot.hp, maxHp: robot.maxHp, heat: robot.heat, maxHeat: robot.maxHeat,
        battery: '23.8 V', signal: '-47 dBm', mode: 'Chassis follow', cpu: '38%',
        aimTarget: 'Blue-03', yawError: '0.8°', pitchError: '-0.3°', aimLocked: true,
      }),
    },
    {
      id: 'hero',
      name: 'Hero',
      role: 'RED-01H',
      connected: false,
      topics: topicsFor({
        x: 8.642, y: 1.207, z: 0, yaw: 176.4, pitch: 0, roll: -0.1,
        hp: 300, maxHp: 300, heat: 18, maxHeat: 200,
        battery: '—', signal: 'No link', mode: 'Safe', cpu: '—',
        aimTarget: 'None', yawError: '—', pitchError: '—', aimLocked: false,
      }),
    },
  ], [robot]);

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
                  <small>{item.role}</small>
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
                              <div className="telemetry-field" key={field.label}>
                                <span className="field-branch">—</span>
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
