import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';

const { robotStateAt } = await loadTypeScript(new URL('../src/telemetry/robotState.ts', import.meta.url));
const { telemetryAt } = await loadTypeScript(new URL('../src/telemetry/mockReplay.ts', import.meta.url));
const { ROBOT_PROFILES } = await loadTypeScript(new URL('../src/robots/profiles.ts', import.meta.url));
const { FIELD_ROBOT_IDS, fieldRobotsAt } = await loadTypeScript(new URL('../src/field/fieldRobots.ts', import.meta.url));

test('Demo off keeps every robot offline regardless of replay time', () => {
  for (const profile of ROBOT_PROFILES) {
    const offline = robotStateAt(0, profile.id, false);
    assert.equal(offline.connected, false);
    assert.equal(offline.robotId, profile.id);
    assert.equal(offline.maxHp, profile.maxHp);
    assert.equal(offline.maxHeat, profile.maxHeat);
    for (const key of ['xM', 'yM', 'zM', 'yawDeg', 'pitchDeg', 'rollDeg', 'hp', 'heat']) {
      assert.equal(offline[key], 0);
    }
    for (const time of [12.5, 42, 77, 84, NaN]) {
      assert.deepEqual(robotStateAt(time, profile.id, false), offline);
    }
  }
});

test('enabling Demo restores the demo readings and simulated connection changes', () => {
  for (const { id } of ROBOT_PROFILES) {
    for (const time of [0, 42, 77, 84]) {
      assert.deepEqual(robotStateAt(time, id, true), telemetryAt(time, id));
    }
    assert.equal(robotStateAt(42, id, true).connected, true);
    assert.equal(robotStateAt(77, id, true).connected, false);
    assert.equal(robotStateAt(84, id, true).connected, true);
  }
});

test('Demo off leaves each field lineup stationary at its starting positions', () => {
  for (const mode of Object.keys(FIELD_ROBOT_IDS)) {
    const offline = fieldRobotsAt(0, mode, false);
    const start = fieldRobotsAt(0, mode, true);
    assert.deepEqual(offline.map((robot) => robot.robotId), FIELD_ROBOT_IDS[mode]);
    offline.forEach((robot, index) => {
      assert.equal(robot.connected, false);
      for (const key of ['xM', 'yM', 'zM', 'yawDeg']) assert.equal(robot[key], start[index][key]);
      assert.equal(robot.pitchDeg, 0);
      assert.equal(robot.rollDeg, 0);
    });
    for (const time of [24, 42, 84, NaN]) assert.deepEqual(fieldRobotsAt(time, mode, false), offline);
    assert.notDeepEqual(fieldRobotsAt(42, mode, true), offline);
  }
});
