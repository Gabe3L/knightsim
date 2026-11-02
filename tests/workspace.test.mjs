import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';
const overlays = await loadTypeScript(new URL('../src/overlays/fieldOverlays.ts', import.meta.url));
const drag = await loadTypeScript(new URL('../src/telemetry/topicDrag.ts', import.meta.url));

test('saved overlay selections migrate while missing sources remain unavailable', () => {
  const defaults = overlays.defaultFieldOverlayWorkspaceState();
  const source = defaults.items[0];
  const state = overlays.parseFieldOverlayWorkspace({ items: [{ ...source, visible: false }, { id: 'unknown' }] });
  assert.equal(state.items.length, defaults.items.length);
  assert.equal(state.items[0].visible, false);
  const resolved = overlays.resolveFieldOverlays(state.items, []);
  assert.equal(resolved[0].sample.available, false);
  assert.equal(resolved[0].visible, false);
});

test('topic drag survives roundtrip and rejects malformed payloads', () => {
  const payload = drag.createTelemetryTopicDragPayload([{ graphSignalId: 'drone.pose.z' }, { graphSignalId: 'drone.pose.z' }]);
  const data = new Map();
  drag.writeTelemetryTopicDrag({ setData: (k, v) => data.set(k, v) }, payload, 'Drone pose');
  assert.deepEqual(drag.readTelemetryTopicDrag({ getData: (k) => data.get(k) }), payload);
  for (const raw of ['null', 'bad', '[]', '{}']) assert.equal(drag.readTelemetryTopicDrag({ getData: () => raw }), null);
});

test('sidebar keyboard shortcut does not steal editing or repeated keys', () => {
  const event = { altKey: false, ctrlKey: false, metaKey: true, code: 'KeyB', repeat: false, target: null };
  assert.equal(overlays.isLeftSidebarShortcut(event, 'darwin'), true);
  assert.equal(overlays.isLeftSidebarShortcut({ ...event, target: { tagName: 'INPUT' } }, 'darwin'), false);
  assert.equal(overlays.isLeftSidebarShortcut({ ...event, repeat: true }, 'darwin'), false);
  assert.equal(overlays.isLeftSidebarShortcut(event, 'win32'), false);
});
