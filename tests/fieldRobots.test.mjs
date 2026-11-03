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
  for (const [mode, ids] of Object.entries({ '1v1': ['infantry'], sentry: ['sentry'], '3v3': ['sentry', 'hero', 'engineer'], drone: ['drone'], dart: ['dart'] })) {
    const spec = FIELD_SPECS[mode];
    const obstacles = mode === '3v3' ? [...spec.barriers, ...spec.sideHighGrounds, spec.centralHighGround.deck]
      .map((r) => ({ x: r.xM + r.widthM / 2, y: r.yM + r.depthM / 2, width: r.widthM, depth: r.depthM, angle: 0 }))
      : mode === '1v1' || mode === 'sentry' ? spec.bunkers.map((r) => ({ x: r.center.xM, y: r.center.yM, width: r.lengthM, depth: r.depthM, angle: r.rotationDeg * Math.PI / 180 })) : [];
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

test('Sentry uses the 1v1 field and route with the Sentry telemetry profile', () => {
  assert.equal(FIELD_SPECS.sentry, FIELD_SPECS['1v1']);
  const profile = robotProfile('sentry');
  for (let time = 0; time <= 84; time += 0.25) {
    const [sentry] = fieldRobotsAt(time, 'sentry');
    const [infantry] = fieldRobotsAt(time, '1v1');
    assert.deepEqual([sentry.xM, sentry.yM, sentry.zM, sentry.yawDeg],
      [infantry.xM, infantry.yM, infantry.zM, infantry.yawDeg]);
    assert.equal(sentry.robotId, profile.id);
    assert.equal(sentry.category, profile.category);
    assert.equal(sentry.maxHp, profile.maxHp);
    assert.equal(sentry.maxHeat, profile.maxHeat);
  }
});

test('drone demo takes off and returns to its own starting zone', () => {
  const start = fieldRobotsAt(0, 'drone')[0], finish = fieldRobotsAt(84, 'drone')[0];
  assert.deepEqual([start.xM, start.yM, start.zM], [25, 6, 0]);
  assert.deepEqual([finish.xM, finish.yM, finish.zM], [25, 6, 0]);
  assert.ok(fieldRobotsAt(40, 'drone')[0].zM > 1);
  for (const time of [NaN, Infinity, -1]) assert.deepEqual(fieldRobotsAt(time, 'drone'), fieldRobotsAt(0, 'drone'));
});

test('Dart preview starts in its launch zone and travels toward its base', () => {
  const { zones: [zone], base } = FIELD_SPECS.dart;
  const [start] = fieldRobotsAt(0, 'dart');
  assert.equal(start.robotId, 'dart');
  assert.deepEqual([start.xM, start.yM], [zone.xM + zone.widthM / 2, zone.yM + zone.depthM / 2]);
  const [mid] = fieldRobotsAt(40, 'dart'), [end] = fieldRobotsAt(84, 'dart');
  const distance = (robot) => Math.hypot(robot.xM - base.xM, robot.yM - base.yM);
  assert.ok(distance(start) > distance(mid) && distance(mid) > distance(end));
  assert.ok(mid.zM > start.zM && mid.zM > end.zM);
  for (const time of [NaN, Infinity, -1]) assert.deepEqual(fieldRobotsAt(time, 'dart'), fieldRobotsAt(0, 'dart'));
  assert.deepEqual(fieldRobotsAt(1000, 'dart'), fieldRobotsAt(84, 'dart'));
});
