import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';
const { ROBOT_PROFILES, robotProfile } = await loadTypeScript(new URL('../src/robots/profiles.ts', import.meta.url));
const { telemetryAt } = await loadTypeScript(new URL('../src/telemetry/mockReplay.ts', import.meta.url));
const { GRAPH_SIGNALS, graphSignalById } = await loadTypeScript(new URL('../src/telemetry/graphSignals.ts', import.meta.url));
const { controllerInputsForRobot } = await loadTypeScript(new URL('../src/telemetry/controllerInputs.ts', import.meta.url));
const { isRobotId } = await loadTypeScript(new URL('../electron/modelLibrary.cts', import.meta.url));

test('every profile has a unique stable ID, valid geometry and an Electron assignment target', () => {
  assert.equal(new Set(ROBOT_PROFILES.map((p) => p.id)).size, ROBOT_PROFILES.length);
  for (const profile of ROBOT_PROFILES) {
    assert.match(profile.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(isRobotId(profile.id));
    assert.equal(robotProfile(profile.id), profile);
    for (const size of Object.values(profile.dimensionsM)) assert.ok(Number.isFinite(size) && size > 0);
    assert.ok(['wheeled', 'omnidirectional', 'tracked', 'legged', 'aerial'].includes(profile.mobility));
    assert.ok(Number.isFinite(profile.demoPhase));
    assert.ok(profile.maxHeat >= 0 && profile.maxHp >= 0);
    assert.equal(profile.capabilities.referee, profile.maxHp > 0);
  }
  assert.throws(() => robotProfile('missing'), /Unknown robot/);
  assert.equal(isRobotId('__proto__'), false);
});

test('all robot telemetry and graph samples agree across a recording', () => {
  assert.equal(new Set(GRAPH_SIGNALS.map((s) => s.id)).size, GRAPH_SIGNALS.length);
  for (const profile of ROBOT_PROFILES) {
    for (const time of [0, 12.5, 42, 77, 84]) {
      const sample = telemetryAt(time, profile.id);
      assert.equal(sample.robotId, profile.id);
      for (const [suffix, key] of [['x', 'xM'], ['y', 'yM'], ['z', 'zM'], ['yaw', 'yawDeg'], ['pitch', 'pitchDeg'], ['roll', 'rollDeg']]) {
        assert.equal(graphSignalById(`${profile.id}.pose.${suffix}`).sampleAt(time), sample[key]);
        assert.ok(Number.isFinite(sample[key]));
      }
      assert.ok(sample.hp >= 0 && sample.hp <= sample.maxHp);
      assert.ok(sample.heat >= 0 && sample.heat <= sample.maxHeat);
      assert.equal(sample.zM > 0, profile.mobility === 'aerial');
    }
    assert.equal(Boolean(graphSignalById(`${profile.id}.referee.hp`)), profile.capabilities.referee);
    assert.equal(Boolean(graphSignalById(`${profile.id}.referee.heat`)), profile.maxHeat > 0);
    assert.equal(Boolean(graphSignalById(`${profile.id}.aim.yaw-error`)), profile.capabilities.aim);
    assert.equal(controllerInputsForRobot(profile.id).length > 0, profile.capabilities.controller);
  }
});

test('invalid and out-of-range demo times cannot produce invalid robot transforms', () => {
  assert.deepEqual(telemetryAt(NaN), telemetryAt(0));
  assert.deepEqual(telemetryAt(-100), telemetryAt(0));
  assert.deepEqual(telemetryAt(1000), telemetryAt(84));
});
