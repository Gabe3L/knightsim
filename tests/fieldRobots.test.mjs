import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';
const { fieldRobotsAt } = await loadTypeScript(new URL('../src/field/fieldRobots.ts', import.meta.url));
const { robotProfile } = await loadTypeScript(new URL('../src/robots/profiles.ts', import.meta.url));
const { FIELD_SPECS } = await loadTypeScript(new URL('../src/field/fieldSpec.ts', import.meta.url));

// Separating-axis check of two oriented rectangles in field coordinates.
function overlaps(a, b) {
  const axes = [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2];
  return axes.every((angle) => {
    const x = Math.cos(angle), y = Math.sin(angle);
    const radius = (r) => Math.abs(Math.cos(r.angle) * x + Math.sin(r.angle) * y) * r.width / 2
      + Math.abs(-Math.sin(r.angle) * x + Math.cos(r.angle) * y) * r.depth / 2;
    return Math.abs((b.x - a.x) * x + (b.y - a.y) * y) < radius(a) + radius(b);
  });
}

test('all preview lineups stay within their field and ground routes avoid the new obstacles', () => {
  for (const [mode, ids] of Object.entries({ '1v1': ['infantry'], '3v3': ['sentry', 'hero', 'engineer'], drone: ['drone'] })) {
    const spec = FIELD_SPECS[mode];
    const obstacles = mode === '3v3' ? [...spec.barriers, ...spec.sideHighGrounds, spec.centralHighGround.deck]
      .map((r) => ({ x: r.xM + r.widthM / 2, y: r.yM + r.depthM / 2, width: r.widthM, depth: r.depthM, angle: 0 }))
      : mode === '1v1' ? spec.bunkers.map((r) => ({ x: r.center.xM, y: r.center.yM, width: r.lengthM, depth: r.depthM, angle: r.rotationDeg * Math.PI / 180 })) : [];
    for (let time = 0; time <= 84; time += 0.25) {
      const robots = fieldRobotsAt(time, mode);
      assert.deepEqual(robots.map((r) => r.robotId), ids);
      for (const robot of robots) {
        const dimensions = robotProfile(robot.robotId).dimensionsM;
        const box = { x: robot.xM, y: robot.yM, width: dimensions.length, depth: dimensions.width, angle: robot.yawDeg * Math.PI / 180 };
        const radius = Math.hypot(dimensions.length, dimensions.width) / 2;
        const floor = spec.floor;
        assert.ok(robot.xM - radius > floor.xM && robot.xM + radius < floor.xM + floor.widthM);
        assert.ok(robot.yM - radius > floor.yM && robot.yM + radius < floor.yM + floor.depthM);
        assert.equal(robot.zM >= 0, true);
        for (const obstacle of obstacles) assert.ok(!overlaps(box, obstacle), `${mode} ${robot.robotId} intersects obstacle at ${time}s`);
      }
    }
  }
});

test('drone demo takes off and returns to its own starting zone', () => {
  const start = fieldRobotsAt(0, 'drone')[0], finish = fieldRobotsAt(84, 'drone')[0];
  assert.deepEqual([start.xM, start.yM, start.zM], [25, 6, 0]);
  assert.deepEqual([finish.xM, finish.yM, finish.zM], [25, 6, 0]);
  assert.ok(fieldRobotsAt(40, 'drone')[0].zM > 1);
  for (const time of [NaN, Infinity, -1]) assert.deepEqual(fieldRobotsAt(time, 'drone'), fieldRobotsAt(0, 'drone'));
});
