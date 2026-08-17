import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TELEMETRY_TOPIC_DRAG_TYPE,
  createTelemetryTopicDragPayload,
  readTelemetryTopicDrag,
  writeTelemetryTopicDrag,
} from './topicDrag.ts';

test('topic payload groups and deduplicates each compatible data kind', () => {
  const payload = createTelemetryTopicDragPayload([
    { graphSignalId: 'infantry.pose.x' },
    { graphSignalId: 'infantry.pose.x' },
    { controllerInputId: 'infantry.inputs.left-stick-x' },
    { fieldOverlayId: 'infantry.odometry.lidar' },
    {},
  ]);

  assert.deepEqual(payload, {
    controllerInputIds: ['infantry.inputs.left-stick-x'],
    fieldOverlayIds: ['infantry.odometry.lidar'],
    graphSignalIds: ['infantry.pose.x'],
  });
});

test('topic drag advertises only the destinations represented by its fields', () => {
  const data = new Map();
  writeTelemetryTopicDrag({ setData: (type, value) => data.set(type, value) }, {
    controllerInputIds: [],
    fieldOverlayIds: [],
    graphSignalIds: ['infantry.pose.x', 'infantry.pose.y'],
  }, 'Infantry / Pose');

  assert.equal(data.has(TELEMETRY_TOPIC_DRAG_TYPE), true);
  assert.equal(data.has('application/x-knightsim-graph-signal'), true);
  assert.equal(data.has('application/x-knightsim-controller-input'), false);
  assert.equal(data.has('application/x-knightsim-field-overlay'), false);
  assert.equal(data.get('text/plain'), 'Infantry / Pose');
});

test('topic payload reader rejects malformed entries and preserves every supplied ID', () => {
  const serialized = JSON.stringify({
    controllerInputIds: ['infantry.inputs.left-stick-x', 3],
    fieldOverlayIds: ['infantry.odometry.lidar', null],
    graphSignalIds: ['infantry.pose.x', 'infantry.pose.y', false],
  });
  const payload = readTelemetryTopicDrag({
    getData: (type) => type === TELEMETRY_TOPIC_DRAG_TYPE ? serialized : '',
  });

  assert.deepEqual(payload, {
    controllerInputIds: ['infantry.inputs.left-stick-x'],
    fieldOverlayIds: ['infantry.odometry.lidar'],
    graphSignalIds: ['infantry.pose.x', 'infantry.pose.y'],
  });
  assert.equal(readTelemetryTopicDrag({ getData: () => '{bad json' }), null);
});
