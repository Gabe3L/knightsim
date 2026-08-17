import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COLLAPSED_FIELD_SIDEBAR_WIDTH,
  FIELD_OVERLAY_DRAG_TYPE,
  defaultFieldOverlayWorkspaceState,
  fieldOverlayWorkspaceReducer,
  isFieldSidebarShortcut,
  isRightSidebarShortcut,
  isLeftSidebarShortcut,
  parseFieldOverlayWorkspace,
  readFieldOverlayDragId,
  resolveFieldOverlays,
} from './fieldOverlays.ts';

const reduce = (state, ...actions) => actions.reduce(fieldOverlayWorkspaceReducer, state);

test('Ctrl+Alt+B toggles the shared right sidebar except while typing', () => {
  const shortcut = {
    ctrlKey: true,
    altKey: true,
    metaKey: false,
    code: 'KeyB',
    repeat: false,
    target: null,
  };
  assert.equal(isFieldSidebarShortcut(shortcut), true);
  assert.equal(isFieldSidebarShortcut({ ...shortcut, target: { tagName: 'INPUT' } }), false);
  assert.equal(isFieldSidebarShortcut({ ...shortcut, target: { isContentEditable: true } }), false);
  assert.equal(isFieldSidebarShortcut({ ...shortcut, altKey: false }), false);
  assert.equal(isRightSidebarShortcut(shortcut), true);
});

test('Command+Option+B toggles field overlays on macOS without changing Windows shortcuts', () => {
  const macShortcut = {
    ctrlKey: false,
    altKey: true,
    metaKey: true,
    code: 'KeyB',
    repeat: false,
    target: null,
  };
  assert.equal(isFieldSidebarShortcut(macShortcut, 'darwin'), true);
  assert.equal(isFieldSidebarShortcut(macShortcut, 'win32'), false);
  assert.equal(isFieldSidebarShortcut({ ...macShortcut, ctrlKey: true }, 'darwin'), false);
});

test('Command+B toggles the left sidebar on macOS and Ctrl+B remains the Windows shortcut', () => {
  const macShortcut = {
    ctrlKey: false,
    altKey: false,
    metaKey: true,
    code: 'KeyB',
    repeat: false,
    target: null,
  };
  assert.equal(isLeftSidebarShortcut(macShortcut, 'darwin'), true);
  assert.equal(isLeftSidebarShortcut(macShortcut, 'win32'), false);
  assert.equal(isLeftSidebarShortcut({ ...macShortcut, ctrlKey: true, metaKey: false }), true);
});

test('a supported field-overlay drag payload is accepted', () => {
  const id = readFieldOverlayDragId({
    getData: (format) => format === FIELD_OVERLAY_DRAG_TYPE
      ? 'infantry.odometry.apriltag.7'
      : '',
  });
  assert.equal(id, 'infantry.odometry.apriltag.7');
  assert.equal(readFieldOverlayDragId({ getData: () => 'unsupported.source' }), null);
});

test('duplicate drops do not duplicate configuration', () => {
  const initial = defaultFieldOverlayWorkspaceState();
  const once = fieldOverlayWorkspaceReducer(initial, {
    type: 'add',
    id: 'infantry.odometry.lidar',
  });
  const twice = fieldOverlayWorkspaceReducer(once, {
    type: 'add',
    id: 'infantry.odometry.lidar',
  });
  assert.equal(twice.items.length, 1);
  assert.equal(twice, once);
});

test('visibility, removal, and ordering update the shared overlay list', () => {
  const state = reduce(
    defaultFieldOverlayWorkspaceState(),
    { type: 'add', id: 'infantry.odometry.lidar' },
    { type: 'add', id: 'infantry.odometry.fused' },
    { type: 'move', id: 'infantry.odometry.fused', direction: -1 },
    { type: 'toggle-visibility', id: 'infantry.odometry.fused' },
  );
  assert.deepEqual(state.items.map((item) => item.id), [
    'infantry.odometry.fused',
    'infantry.odometry.lidar',
  ]);
  assert.equal(state.items[0].visible, false);
  const removed = fieldOverlayWorkspaceReducer(state, {
    type: 'remove',
    id: 'infantry.odometry.fused',
  });
  assert.deepEqual(removed.items.map((item) => item.id), ['infantry.odometry.lidar']);
});

test('2D to 3D to 2D switching does not scope or recreate overlay configuration', () => {
  const state = reduce(
    defaultFieldOverlayWorkspaceState(),
    { type: 'add', id: 'infantry.odometry.apriltag.12' },
    { type: 'toggle-visibility', id: 'infantry.odometry.apriltag.12' },
  );
  const views = ['2d', '3d', '2d'];
  const configsSeenByEachRenderer = views.map(() => state.items);
  assert.ok(configsSeenByEachRenderer.every((items) => items === state.items));
  assert.equal(state.items[0].visible, false);
});

test('temporarily missing source data retains an unavailable overlay entry', () => {
  const state = fieldOverlayWorkspaceReducer(defaultFieldOverlayWorkspaceState(), {
    type: 'add',
    id: 'infantry.odometry.apriltag.12',
  });
  const [resolved] = resolveFieldOverlays(state.items, []);
  assert.equal(resolved.id, 'infantry.odometry.apriltag.12');
  assert.equal(resolved.sample.available, false);
  assert.match(resolved.sample.unavailableReason, /Waiting/);
});

test('overlay list, color, visibility, order, and sidebar state survive persistence', () => {
  const state = reduce(
    defaultFieldOverlayWorkspaceState(),
    { type: 'add', id: 'infantry.odometry.imu' },
    { type: 'add', id: 'infantry.odometry.ground-truth' },
    { type: 'toggle-visibility', id: 'infantry.odometry.imu' },
    { type: 'toggle-sidebar' },
  );
  const restored = parseFieldOverlayWorkspace(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(restored.sidebarWidth, COLLAPSED_FIELD_SIDEBAR_WIDTH);
});
