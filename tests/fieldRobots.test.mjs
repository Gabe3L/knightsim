import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';

const { fieldRobotsAt } = await loadTypeScript(new URL('../src/field/fieldRobots.ts', import.meta.url));
const { robotProfile } = await loadTypeScript(new URL('../src/robots/profiles.ts', import.meta.url));

test('each field mode renders its full lineup throughout playback', () => {
  for (const [mode, ids] of Object.entries({
    '1v1': ['infantry'], '3v3': ['sentry', 'hero', 'engineer'], drone: ['drone'],
  })) {
    for (let time = 0; time <= 84; time++) {
      const robots = fieldRobotsAt(time, mode);
      assert.deepEqual(robots.map((robot) => robot.robotId), ids);
      for (const robot of robots) {
        const dimensions = robotProfile(robot.robotId).dimensionsM;
        const length = mode === '1v1' ? 5 : 12;
        const width = mode === '1v1' ? 5 : 8;
        assert.ok(robot.xM > dimensions.length / 2 && robot.xM < length - dimensions.length / 2);
        assert.ok(robot.yM > dimensions.width / 2 && robot.yM < width - dimensions.width / 2);
        assert.equal(robot.zM > 0, mode === 'drone');
      }
      for (let index = 1; index < robots.length; index++) {
        assert.ok(Math.abs(robots[index].yM - robots[index - 1].yM) >= 1);
      }
    }
  }
});
