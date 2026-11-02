import { ROBOT_PROFILES, robotProfile } from '../robots/profiles';
import { telemetryAt } from '../telemetry/mockReplay';
import { useMemo, useState, type DragEvent } from 'react';
import {
  Bot,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  GripVertical,
} from 'lucide-react';
import {
  GRAPH_SIGNAL_DRAG_TYPE,
  graphSignalById,
  graphSignalValueAt,
} from '../telemetry/graphSignals';
import { FIELD_OVERLAY_SOURCES, type ResolvedFieldOverlay } from '../overlays/fieldOverlays';
import {
  controllerInputsForRobot,
} from '../telemetry/controllerInputs';
import { odometryDebugAt } from '../telemetry/odometryDebug';
import {
  createTelemetryTopicDragPayload,
  writeTelemetryTopicDrag,
} from '../telemetry/topicDrag';
import type { RobotId, RobotTelemetry } from '../types';

interface InspectorProps {
  readonly robot: RobotTelemetry;
  readonly currentTimeS: number;
  readonly collapsed?: boolean;
  readonly controllerInputIds: readonly string[];
  readonly graphSignalIds: readonly string[];
  readonly overlays: readonly ResolvedFieldOverlay[];
  readonly onToggleControllerInput: (id: string) => void;
  readonly onToggleFieldOverlay: (id: string) => void;
  readonly onToggleGraphSignal: (id: string) => void;
}

interface TelemetryField {
  readonly label: string;
  readonly value: string;
  readonly controllerInputId?: string;
  readonly graphSignalId?: string;
  readonly fieldOverlayId?: string;
}

interface TelemetryTopic {
  readonly id: string;
  readonly label: string;
  readonly fields: readonly TelemetryField[];
}

interface RobotNode {
  readonly id: RobotId;
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

function topicsFor(snapshot: RobotSnapshot, robotId: RobotId, timeS: number): readonly TelemetryTopic[] {
  const profile = robotProfile(robotId);
  const topics: TelemetryTopic[] = [
    {
      id: 'inputs',
      label: 'Inputs',
      fields: controllerInputsForRobot(robotId).map((descriptor) => {
        const value = descriptor.sampleAt(timeS);
        return {
          label: descriptor.label,
          value: descriptor.format(value),
          controllerInputId: descriptor.id,
        };
      }),
    },
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
        ...(profile.maxHeat > 0 ? [graphField('Barrel heat', `${robotId}.referee.heat`, timeS, `${snapshot.heat} / ${snapshot.maxHeat}`)] : []),
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

  if (robotId === 'infantry') {
    const sampleById = new Map(odometryDebugAt(timeS).map((sample) => [sample.id, sample]));
    topics.splice(1, 0, {
      id: 'odometry',
      label: 'Odometry',
      fields: FIELD_OVERLAY_SOURCES.map((source) => {
        const sample = sampleById.get(source.id);
        const state = !sample?.available ? 'Unavailable' : sample.status ?? 'Available';
        return {
          label: source.name,
          value: state[0]!.toUpperCase() + state.slice(1),
          fieldOverlayId: source.id,
        };
      }),
    });
  }

  return topics.filter((topic) => topic.fields.length > 0
    && (topic.id !== 'referee' || profile.capabilities.referee)
    && (topic.id !== 'aim' || profile.capabilities.aim));
}

function toggleKey(current: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function isFieldDisplayed(
  field: TelemetryField,
  displayedControllerInputs: ReadonlySet<string>,
  displayedGraphSignals: ReadonlySet<string>,
  displayedFieldOverlays: ReadonlySet<string>,
): boolean {
  if (field.controllerInputId) return displayedControllerInputs.has(field.controllerInputId);
  if (field.graphSignalId) return displayedGraphSignals.has(field.graphSignalId);
  if (field.fieldOverlayId) return displayedFieldOverlays.has(field.fieldOverlayId);
  return false;
}

export function Inspector({
  robot,
  currentTimeS,
  collapsed = false,
  controllerInputIds,
  graphSignalIds,
  overlays,
  onToggleControllerInput,
  onToggleFieldOverlay,
  onToggleGraphSignal,
}: InspectorProps) {
  const [expandedRobots, setExpandedRobots] = useState<ReadonlySet<string>>(() => new Set(['infantry']));
  const [expandedTopics, setExpandedTopics] = useState<ReadonlySet<string>>(() => new Set([
    'infantry:inputs',
    'infantry:odometry',
  ]));
  const displayedControllerInputs = useMemo(() => new Set(controllerInputIds), [controllerInputIds]);
  const displayedGraphSignals = useMemo(() => new Set(graphSignalIds), [graphSignalIds]);
  const displayedFieldOverlays = useMemo(() => new Set(
    overlays.filter((overlay) => overlay.visible).map((overlay) => overlay.id),
  ), [overlays]);

  const robots = useMemo<readonly RobotNode[]>(() => ROBOT_PROFILES.map((profile) => {
    const sample = profile.id === robot.robotId ? robot : telemetryAt(currentTimeS, profile.id);
    return {
      id: profile.id,
      name: profile.name,
      connected: sample.connected,
      topics: expandedRobots.has(profile.id) && !collapsed ? topicsFor({
        x: sample.xM, y: sample.yM, z: sample.zM,
        yaw: sample.yawDeg, pitch: sample.pitchDeg, roll: sample.rollDeg,
        hp: sample.hp, maxHp: sample.maxHp, heat: sample.heat, maxHeat: sample.maxHeat,
        battery: '24 V', signal: sample.connected ? '-47 dBm' : 'No link',
        mode: profile.mobility, cpu: '38%', aimTarget: 'Demo target',
        yawError: '0°', pitchError: '0°', aimLocked: sample.connected,
      }, profile.id, currentTimeS) : [],
    };
  }), [currentTimeS, robot, expandedRobots, collapsed]);

  const startSignalDrag = (event: DragEvent<HTMLDivElement>, graphSignalId: string): void => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(GRAPH_SIGNAL_DRAG_TYPE, graphSignalId);
    event.dataTransfer.setData('text/plain', graphSignalId);
  };

  const startTopicDrag = (
    event: DragEvent<HTMLButtonElement>,
    robotName: string,
    topic: TelemetryTopic,
  ): void => {
    event.dataTransfer.effectAllowed = 'copy';
    writeTelemetryTopicDrag(
      event.dataTransfer,
      createTelemetryTopicDragPayload(topic.fields),
      `${robotName} / ${topic.label}`,
    );
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
                    const topicDragPayload = createTelemetryTopicDragPayload(topic.fields);
                    const topicDraggable = topicDragPayload.graphSignalIds.length > 0;
                    const displayableFields = topic.fields.filter((field) => (
                      field.controllerInputId || field.graphSignalId || field.fieldOverlayId
                    ));
                    const displayedFieldCount = displayableFields.filter((field) => isFieldDisplayed(
                      field,
                      displayedControllerInputs,
                      displayedGraphSignals,
                      displayedFieldOverlays,
                    )).length;
                    const allFieldsDisplayed = displayedFieldCount === displayableFields.length;
                    const someFieldsDisplayed = displayedFieldCount > 0 && !allFieldsDisplayed;
                    const displayLocation = topic.id === 'inputs'
                      ? 'on controller'
                      : topic.id === 'odometry'
                        ? 'on field'
                        : 'on graph';

                    const toggleTopicDisplay = (): void => {
                      const shouldDisplay = !allFieldsDisplayed;
                      displayableFields.forEach((field) => {
                        const displayed = isFieldDisplayed(
                          field,
                          displayedControllerInputs,
                          displayedGraphSignals,
                          displayedFieldOverlays,
                        );
                        if (displayed === shouldDisplay) return;
                        if (field.controllerInputId) onToggleControllerInput(field.controllerInputId);
                        else if (field.graphSignalId) onToggleGraphSignal(field.graphSignalId);
                        else if (field.fieldOverlayId) onToggleFieldOverlay(field.fieldOverlayId);
                      });
                    };

                    return (
                      <div className={topicExpanded ? 'topic-node expanded' : 'topic-node'} key={topic.id}>
                        <div className="topic-node-header">
                          <button
                            className="topic-node-toggle"
                            type="button"
                            draggable={topicDraggable}
                            aria-expanded={topicExpanded}
                            aria-controls={`${item.id}-${topic.id}-fields`}
                            onClick={() => setExpandedTopics((current) => toggleKey(current, topicKey))}
                            onDragStart={topicDraggable
                              ? (event) => startTopicDrag(event, item.name, topic)
                              : undefined}
                            title={topicDraggable ? 'Drag to graph every numeric field in this topic' : undefined}
                          >
                            <ChevronRight className="tree-chevron" size={14} />
                            <span>{topic.label}</span>
                          </button>
                          {displayableFields.length > 0 ? (
                            <button
                              className={someFieldsDisplayed
                                ? 'topic-visibility-toggle mixed'
                                : 'topic-visibility-toggle'}
                              type="button"
                              aria-label={`${allFieldsDisplayed ? 'Hide' : 'Show'} all ${topic.label} fields ${displayLocation}`}
                              aria-pressed={someFieldsDisplayed ? 'mixed' : allFieldsDisplayed}
                              title={`${allFieldsDisplayed ? 'Hide' : 'Show'} all ${displayLocation}`}
                              onClick={toggleTopicDisplay}
                            >
                              {allFieldsDisplayed ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                          ) : null}
                        </div>

                        {topicExpanded ? (
                          <dl className="telemetry-fields" id={`${item.id}-${topic.id}-fields`}>
                            {topic.fields.map((field) => {
                              const graphDraggable = Boolean(field.graphSignalId);
                              const displayable = Boolean(
                                field.controllerInputId || field.graphSignalId || field.fieldOverlayId,
                              );
                              const displayed = isFieldDisplayed(
                                field,
                                displayedControllerInputs,
                                displayedGraphSignals,
                                displayedFieldOverlays,
                              );
                              const displayLocation = field.fieldOverlayId
                                ? 'on field'
                                : field.graphSignalId
                                  ? 'on graph'
                                  : 'on controller';
                              const toggleDisplay = (): void => {
                                if (field.controllerInputId) onToggleControllerInput(field.controllerInputId);
                                else if (field.graphSignalId) onToggleGraphSignal(field.graphSignalId);
                                else if (field.fieldOverlayId) onToggleFieldOverlay(field.fieldOverlayId);
                              };

                              return (
                                <div
                                  className={[
                                    'telemetry-field',
                                    graphDraggable && 'telemetry-field-draggable',
                                    displayable && 'telemetry-field-displayable',
                                    displayed && 'telemetry-field-displayed',
                                  ].filter(Boolean).join(' ')}
                                  draggable={graphDraggable}
                                  key={field.label}
                                  title={graphDraggable ? 'Drag into Graph Signals' : undefined}
                                  onDragStart={field.graphSignalId
                                    ? (event) => startSignalDrag(event, field.graphSignalId!)
                                    : undefined}
                                >
                                  <span className="field-branch">
                                    {graphDraggable ? <GripVertical size={11} /> : '—'}
                                  </span>
                                  <dt>{field.label}</dt>
                                  <dd>{field.value}</dd>
                                  {displayable ? (
                                    <button
                                      className="field-visibility-toggle"
                                      type="button"
                                      aria-label={`${displayed ? 'Hide' : 'Show'} ${field.label} ${displayLocation}`}
                                      aria-pressed={displayed}
                                      title={`${displayed ? 'Hide' : 'Show'} ${displayLocation}`}
                                      onClick={toggleDisplay}
                                    >
                                      {displayed ? <Eye size={13} /> : <EyeOff size={13} />}
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
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
