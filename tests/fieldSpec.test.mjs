import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';
const {
  ARCC_2027_3V3_FIELD: three, ARCC_2027_1V1_FIELD: one, ARCC_2027_DRONE_FIELD: drone,
  ARCC_2027_DART_FIELD: dart,
  FIELD_SPECS, fieldWorldX, fieldWorldZ,
} = await loadTypeScript(new URL('../src/field/fieldSpec.ts', import.meta.url));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('Season 2 3v3: dimensioned platforms, walls, scoring areas and clear openings', () => {
  assert.deepEqual(three.size, { lengthM: 12, widthM: 8 });
  close(three.wall.heightM, 0.5);
  for (const zone of three.zones) {
    close(zone.yM, 0); close(zone.widthM, 1.5); close(zone.depthM, 2); close(zone.tapeWidthM, 0.0508);
  }
  const deck = three.centralHighGround.deck;
  assert.deepEqual([deck.xM, deck.yM, deck.widthM, deck.depthM, deck.heightM], [4.5, 6, 3, 2, 0.21]);
  const [leftRamp, rightRamp] = three.centralHighGround.ramps;
  close(leftRamp.xM + leftRamp.widthM, deck.xM);
  close(rightRamp.xM, deck.xM + deck.widthM);
  // Nominal 210/784 mm rounds to the manual's 15 degrees.
  assert.ok(Math.abs(Math.atan2(leftRamp.heightM, leftRamp.widthM) * 180 / Math.PI - 15) < 0.01);
  const center = three.barriers.find((wall) => wall.id === 'central-wall');
  close(center.xM + center.widthM / 2, 6);
  close(center.depthM, 3); close(center.heightM, 0.422);
  close(center.sheetHeightM, 1.406); close(center.sheetLengthM, 2.559);
  const [central, ...sides] = three.limboBars;
  close(central.clearanceM, 0.42); close(central.openingM, 0.6);
  close(6 - central.beamHeightM - (center.yM + center.depthM), central.openingM);
  for (const side of sides) { close(side.clearanceM, 0.3); close(side.openingM, 1); }
  for (const area of three.scoringAreas) {
    assert.deepEqual([area.widthM, area.depthM, area.heightM], [0.3, 0.3, 0.05]);
    close(8 - area.yM - area.depthM, 0.85);
    const chute = three.pipeChutes.find((chute) => chute.id.startsWith(area.team));
    close(chute.xM, area.xM + area.widthM / 2); close(chute.zM, 0.6);
  }
  close(three.chute.openingDiameterM, 0.0525);
});

test('Season 2 road: central 16×4 tiles and two mirrored 12-tile L shapes, with four real bumps per tile', () => {
  const road = three.bumpyRoad;
  assert.equal(road.tiles.length, 88);
  assert.equal(new Set(road.tiles.map((tile) => tile.id)).size, 88);
  const central = road.tiles.filter((tile) => tile.id.startsWith('central'));
  assert.equal(central.length, 64);
  close(Math.min(...central.map((tile) => tile.xM)), 2.8);
  close(Math.max(...central.map((tile) => tile.xM + tile.widthM)), 9.2);
  close(Math.min(...central.map((tile) => tile.yM)), 3);
  close(Math.max(...central.map((tile) => tile.yM + tile.depthM)), 4.6);
  for (const red of road.tiles.filter((tile) => tile.id.startsWith('red'))) {
    const blue = road.tiles.find((tile) => tile.id === red.id.replace('red-', 'blue-'));
    close(red.xM + red.widthM + blue.xM, 12); close(red.yM, blue.yM);
  }
  assert.deepEqual([road.tileSizeM, road.baseThicknessM, road.bumpHeightM, road.bumpCount], [0.4, 0.0025, 0.0012, 4]);
  close(road.baseThicknessM + road.bumpHeightM, 0.0037);
});

test('Season 2 objectives have the specified count, dimensions and starting elevations', () => {
  const { cube, bucket, pipes, donuts, donut, pole } = three.objectives;
  assert.deepEqual([cube.xM, cube.yM, cube.zM, cube.sideM], [6, 7, 0.21, 0.1]);
  assert.deepEqual([bucket.xM, bucket.yM, bucket.diameterM, bucket.heightM], [6, 1, 0.2, 0.25]);
  assert.deepEqual([pipes.redCount, pipes.blueCount, pipes.lengthM, pipes.outerDiameterM], [5, 5, 0.5, 0.0267]);
  assert.equal(donuts.length, 2);
  close(donuts[0].xM + donuts[1].xM, 12);
  assert.deepEqual([donut.outerDiameterM, donut.innerDiameterM, donut.thicknessM, pole.heightM], [0.1, 0.05, 0.025, 0.456]);
  for (const point of donuts) {
    const lower = three.sideHighGrounds.find((deck) => point.xM > deck.xM && point.xM < deck.xM + deck.widthM
      && point.yM > deck.yM && point.yM < deck.yM + deck.depthM);
    close(lower.heightM, point.zM);
  }
});

test('1v1 bunkers reproduce all four dimensioned face endpoints in Figure 4-3', () => {
  assert.deepEqual(one.size, { lengthM: 5, widthM: 5 });
  const expected = [[[1.4, 2.15], [2, 2.95]], [[3, 2.05], [3.6, 2.85]]];
  one.bunkers.forEach((bunker, index) => {
    close(bunker.lengthM, 1); close(bunker.depthM, 0.17); close(bunker.heightM, 0.422);
    const a = bunker.rotationDeg * Math.PI / 180;
    const face = index === 0 ? -1 : 1;
    [-1, 1].forEach((end, j) => {
      close(bunker.center.xM + end * Math.cos(a) / 2 + face * Math.sin(a) * 0.085, expected[index][j][0]);
      close(bunker.center.yM + end * Math.sin(a) / 2 - face * Math.cos(a) * 0.085, expected[index][j][1]);
    });
  });
});

test('drone launch centre has the specified offsets from the base; coordinate mapping preserves distances', () => {
  assert.equal(drone.wall, null);
  const zone = drone.zones[0], base = drone.base;
  const cx = zone.xM + zone.widthM / 2, cy = zone.yM + zone.depthM / 2;
  close(cx - base.xM, 25); close(cy - base.yM, 6);
  assert.deepEqual([zone.widthM, zone.depthM], [2.2, 2.2]);
  assert.deepEqual([base.armorCenterRadiusM, base.armorCenterHeightM, base.armorTiltDeg], [0.268, 0.461, 13.9]);
  assert.equal(base.armorAnglesDeg.length, 3);
  close(Math.abs(fieldWorldX(cx, 'drone') - fieldWorldX(base.xM, 'drone')), 25);
  close(Math.abs(fieldWorldZ(cy, 'drone') - fieldWorldZ(base.yM, 'drone')), 6);
  for (const [mode, spec] of Object.entries(FIELD_SPECS)) {
    close(fieldWorldX(spec.size.lengthM / 2, mode), 0);
    close(fieldWorldZ(spec.size.widthM / 2, mode), 0);
  }
});

test('Dart Figure 7-1 offsets and starting zone use the shared blue base', () => {
  assert.equal(FIELD_SPECS.dart, dart);
  assert.equal(dart.wall, null);
  assert.equal(dart.base, drone.base);
  const zone = dart.zones[0], base = dart.base;
  const cx = zone.xM + zone.widthM / 2, cy = zone.yM + zone.depthM / 2;
  assert.equal(zone.team, 'red');
  assert.deepEqual([zone.widthM, zone.depthM], [1, 0.6]);
  close(cx - base.xM, 25.5); close(cy - base.yM, 3);
  close(Math.abs(fieldWorldX(cx, 'dart') - fieldWorldX(base.xM, 'dart')), 25.5);
  close(Math.abs(fieldWorldZ(cy, 'dart') - fieldWorldZ(base.yM, 'dart')), 3);
  assert.ok(dart.floor.xM < base.xM && dart.floor.yM < base.yM);
  assert.ok(dart.floor.xM + dart.floor.widthM > zone.xM + zone.widthM);
  assert.ok(dart.floor.yM + dart.floor.depthM > zone.yM + zone.depthM);
});
