import assert from 'node:assert/strict';
import test from 'node:test';

import { FIELD_CAMERA_KEYBINDINGS, fieldCameraActionForCode } from './keybindings.ts';

test('field camera keybindings cover all six flight directions', () => {
  assert.deepEqual(
    FIELD_CAMERA_KEYBINDINGS.map(({ action, code }) => [action, code]),
    [
      ['forward', 'KeyW'],
      ['back', 'KeyS'],
      ['left', 'KeyA'],
      ['right', 'KeyD'],
      ['up', 'KeyE'],
      ['down', 'KeyQ'],
    ],
  );
  for (const { action, code } of FIELD_CAMERA_KEYBINDINGS) {
    assert.equal(fieldCameraActionForCode(code), action);
  }
  assert.equal(fieldCameraActionForCode('Escape'), null);
});
