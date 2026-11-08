import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';

const { handleReplayShortcut } = await loadTypeScript(new URL('../src/replayShortcuts.ts', import.meta.url));
const { fieldCameraActionForCode } = await loadTypeScript(new URL('../src/keybindings.ts', import.meta.url));

function setup(overrides = {}) {
  const seeks = [];
  let toggles = 0;
  let otherActions = 0;
  const options = {
    disabled: false,
    replay: { currentTimeS: 10, durationS: 90, playing: false, speed: 1 },
    onSeek: (timeS) => seeks.push(timeS),
    onTogglePlaying: () => toggles++,
    ...overrides,
  };
  const target = new EventTarget();
  target.addEventListener('keydown', (event) => handleReplayShortcut(event, options), true);
  target.addEventListener('keyup', (event) => handleReplayShortcut(event, options), true);
  for (const type of ['keydown', 'keyup']) target.addEventListener(type, () => otherActions++);
  return {
    seeks,
    get toggles() { return toggles; },
    get otherActions() { return otherActions; },
    press(code, properties = {}, type = 'keydown') {
      const event = Object.assign(new Event(type, { cancelable: true }), {
        code, altKey: false, ctrlKey: false, metaKey: false, isComposing: false, repeat: false,
        ...properties,
      });
      target.dispatchEvent(event);
      return event;
    },
  };
}

test('horizontal arrows seek five seconds, vertical arrows seek half a second, and both phases are consumed', () => {
  const shortcuts = setup();
  for (const code of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']) {
    assert.equal(shortcuts.press(code).defaultPrevented, true);
    assert.equal(shortcuts.press(code, {}, 'keyup').defaultPrevented, true);
    assert.equal(fieldCameraActionForCode(code), null);
  }
  assert.deepEqual(shortcuts.seeks, [5, 9.5, 15, 10.5]);
  assert.equal(shortcuts.otherActions, 0);
  assert.equal(shortcuts.toggles, 0);
});

test('seeks clamp to replay boundaries and held arrows continue seeking', () => {
  for (const [currentTimeS, code, expected] of [
    [2, 'ArrowLeft', 0], [88, 'ArrowRight', 90],
    [0.25, 'ArrowDown', 0], [89.75, 'ArrowUp', 90],
  ]) {
    const shortcuts = setup({ replay: { currentTimeS, durationS: 90 } });
    shortcuts.press(code);
    shortcuts.press(code, { repeat: true });
    assert.deepEqual(shortcuts.seeks, [expected, expected]);
  }
});

test('Space toggles once per press and never activates a focused control on release', () => {
  const shortcuts = setup();
  for (const repeat of [false, true, true]) assert.equal(shortcuts.press('Space', { repeat }).defaultPrevented, true);
  assert.equal(shortcuts.press('Space', {}, 'keyup').defaultPrevented, true);
  assert.equal(shortcuts.toggles, 1);
  assert.equal(shortcuts.otherActions, 0);
  assert.equal(fieldCameraActionForCode('Space'), null);
});

test('disabled replay consumes shortcuts without changing playback or other controls', () => {
  const shortcuts = setup({ disabled: true });
  for (const code of ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    assert.equal(shortcuts.press(code).defaultPrevented, true);
  }
  assert.deepEqual(shortcuts.seeks, []);
  assert.equal(shortcuts.toggles, 0);
  assert.equal(shortcuts.otherActions, 0);
});

test('modified keys, composition and camera controls keep their existing behavior', () => {
  const shortcuts = setup();
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'isComposing']) {
    assert.equal(shortcuts.press('ArrowRight', { [modifier]: true }).defaultPrevented, false);
  }
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']) {
    assert.equal(shortcuts.press(code).defaultPrevented, false);
    assert.notEqual(fieldCameraActionForCode(code), null);
  }
  assert.deepEqual(shortcuts.seeks, []);
  assert.equal(shortcuts.toggles, 0);
  assert.equal(shortcuts.otherActions, 10);
});
