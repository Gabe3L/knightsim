import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { loadTypeScript } from './loadTypeScript.mjs';

const { defaultFieldCameraPose, FIELD_CAMERA_FOV, FIELD_CAMERA_TRANSITION_MS, FieldCameraViews } = await loadTypeScript(
  new URL('../src/camera/FieldCameraViews.ts', import.meta.url),
);
const { FIELD_SPECS, fieldWorldX, fieldWorldZ } = await loadTypeScript(new URL('../src/field/fieldSpec.ts', import.meta.url));
const { fieldCameraBounds, cameraMovementBounds, CAMERA_BARRIER_WARNING_M } = await loadTypeScript(new URL('../src/camera/CameraFlightBounds.ts', import.meta.url));
const { CameraFlight } = await loadTypeScript(new URL('../src/camera/CameraFlight.ts', import.meta.url));
const state = { targetXM: 6, targetYM: 4, zoom: 1 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

function createViews() {
  const camera = new PerspectiveCamera();
  let nowMs = 0;
  const views = new FieldCameraViews(camera, () => nowMs);
  return {
    camera, views,
    advance(ms) { nowMs += ms; return views.update(); },
  };
}

function cameraAtSpawn(mode, width, height) {
  const camera = new PerspectiveCamera(FIELD_CAMERA_FOV, width / height, 0.05, 250);
  const pose = defaultFieldCameraPose(mode, width, height, state);
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.updateMatrixWorld();
  return camera;
}

test('normal overviews start clear of the barriers and even narrow overviews stay within flight limits', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    for (const [width, height] of [[700, 1000], [1440, 800], [1280, 520], [400, 1000], [150, 1200]]) {
      const { position } = defaultFieldCameraPose(mode, width, height, state);
      const bounds = fieldCameraBounds(mode, position);
      assert.ok(bounds.containsPoint(position), `${mode}: overview inside flight limits`);
      assert.ok(Math.min(position.x - bounds.min.x, bounds.max.x - position.x,
        position.z - bounds.min.z, bounds.max.z - position.z, bounds.max.y - position.y) > CAMERA_BARRIER_WARNING_M,
      `${mode}: no barrier over the normal overview`);
    }
  }
});

test('landscape flight limits keep every field large enough to inspect', () => {
  const limits = { '1v1': [7.5, 5.5, 7.5], sentry: [7.5, 5.5, 7.5], '3v3': [13.5, 8.5, 9.5], drone: [22.5, 9.5, 8.5], dart: [22.5, 7, 7.5] };
  for (const [mode, [x, y, z]] of Object.entries(limits)) {
    const bounds = fieldCameraBounds(mode, defaultFieldCameraPose(mode, 1440, 800, state).position);
    assert.ok(bounds.min.x >= -x && bounds.max.x <= x, `${mode}: nearby field ends`);
    assert.ok(bounds.max.y <= y, `${mode}: nearby ceiling`);
    assert.ok(bounds.min.z >= -z && bounds.max.z <= z, `${mode}: nearby field sides`);
  }
});

test('end-corner starting views use a low angle and fit the field above the timeline', () => {
  for (const [mode, spec] of Object.entries(FIELD_SPECS)) {
    for (const [width, height] of [[700, 1000], [1000, 1000], [1440, 800], [1920, 800], [1280, 520]]) {
      const camera = cameraAtSpawn(mode, width, height);
      const pad = spec.wall?.thicknessM ?? 0;
      const top = mode === 'drone' ? 2.5 : mode === 'dart' ? 2.7 : mode === '3v3' ? 1.5 : 1.2;
      assert.ok(camera.position.y > top, `${mode} should start above the scenery`);
      const direction = camera.getWorldDirection(new Vector3());
      const elevation = Math.asin(-direction.y) * 180 / Math.PI;
      assert.ok(elevation >= 18 && elevation <= 25, `${mode}: a flatter starting angle`);
      const end = mode === 'drone' || mode === 'dart' ? -1 : 1;
      assert.ok(camera.position.x * end > spec.size.lengthM / 2, `${mode}: beyond the field end`);
      assert.ok(camera.position.z * -end > spec.size.widthM / 2, `${mode}: outside the corner`);
      assert.ok(direction.x * end < 0 && direction.z * end > 0, `${mode}: looks into the field`);
      for (const x of [spec.floor.xM - pad, spec.floor.xM + spec.floor.widthM + pad]) {
        for (const y of [spec.floor.yM - pad, spec.floor.yM + spec.floor.depthM + pad]) {
          for (const altitude of [0, top]) {
            const point = new Vector3(fieldWorldX(x, mode), altitude, fieldWorldZ(y, mode)).project(camera);
            const label = `${mode} at ${width}×${height}`;
            assert.ok(Math.abs(point.x) <= 0.9 + 1e-9, `${label}: horizontal margin`);
            assert.ok(point.y <= 0.9 + 1e-9, `${label}: top margin`);
            assert.ok((1 + point.y) * height / 2 >= 84 + height * 0.05 - 1e-9, `${label}: timeline clearance`);
            assert.ok(point.z > -1 && point.z < 1, `${label}: near/far clipping`);
          }
        }
      }
    }
  }
});

test('challenge views look from the launch end toward the base', () => {
  for (const mode of ['drone', 'dart']) {
    const spec = FIELD_SPECS[mode], zone = spec.zones[0];
    const camera = cameraAtSpawn(mode, 1440, 800);
    const base = new Vector3(fieldWorldX(spec.base.xM, mode), 0, fieldWorldZ(spec.base.yM, mode)).applyMatrix4(camera.matrixWorldInverse);
    const launch = new Vector3(fieldWorldX(zone.xM + zone.widthM / 2, mode), 0,
      fieldWorldZ(zone.yM + zone.depthM / 2, mode)).applyMatrix4(camera.matrixWorldInverse);
    assert.ok(launch.z > base.z, `${mode}: the launch zone is closer than the base`);
  }
});

test('the initial field opens directly at its overview', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    const { camera, views, advance } = createViews();
    const pose = defaultFieldCameraPose(mode, 1440, 800, state);
    assert.equal(views.select(mode, 1440, 800, state), true);
    assert.ok(camera.position.equals(pose.position));
    assert.ok(camera.quaternion.equals(pose.quaternion));
    assert.equal(advance(0), false);
  }
});

test('each field switch eases position and direction to the destination and finishes exactly', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    const { camera, views, advance } = createViews();
    views.select(mode === '3v3' ? 'sentry' : '3v3', 1440, 800, state);
    const start = camera.position.clone(), rotation = camera.quaternion.clone();
    const target = defaultFieldCameraPose(mode, 1440, 800, state);
    const distance = start.distanceTo(target.position);
    const angle = rotation.angleTo(target.quaternion);

    views.select(mode, 1440, 800, state);
    assert.ok(camera.position.equals(start), `${mode}: no jump on selection`);
    assert.ok(camera.quaternion.equals(rotation));
    assert.equal(advance(FIELD_CAMERA_TRANSITION_MS / 4), true);
    const earlyDistance = start.distanceTo(camera.position) / distance;
    const earlyAngle = rotation.angleTo(camera.quaternion) / angle;
    assert.ok(earlyDistance > 0 && earlyDistance < 0.25, `${mode}: position eases in`);
    assert.ok(earlyAngle > 0 && earlyAngle < 0.25, `${mode}: direction eases in`);

    advance(FIELD_CAMERA_TRANSITION_MS / 4);
    close(start.distanceTo(camera.position) / distance, 0.5);
    close(rotation.angleTo(camera.quaternion) / angle, 0.5);
    close(camera.quaternion.length(), 1);
    camera.position.toArray().forEach((value, index) => close(camera.matrixWorld.elements[12 + index], value));

    advance(FIELD_CAMERA_TRANSITION_MS / 4);
    const lateDistance = start.distanceTo(camera.position) / distance;
    assert.ok(lateDistance > 0.75 && lateDistance < 1, `${mode}: position eases out`);
    assert.equal(advance(FIELD_CAMERA_TRANSITION_MS / 4), false);
    assert.ok(camera.position.equals(target.position));
    assert.ok(camera.quaternion.equals(target.quaternion));
    assert.equal(advance(16), false);
  }
});

test('switching fields transitions to new spawns and restores prior flight poses', () => {
  const { camera, views, advance } = createViews();
  assert.equal(views.select('3v3', 1440, 800, state), true);
  camera.position.set(3, 4, 5);
  camera.lookAt(1, 2, 3);
  const arenaPosition = camera.position.clone(), arenaRotation = camera.quaternion.clone();

  assert.equal(views.select('drone', 700, 1000, state), true);
  const droneSpawn = defaultFieldCameraPose('drone', 700, 1000, state);
  advance(FIELD_CAMERA_TRANSITION_MS);
  assert.ok(camera.position.equals(droneSpawn.position));
  assert.ok(camera.quaternion.equals(droneSpawn.quaternion));
  camera.position.set(-18, 7, 4);
  camera.lookAt(-20, 1, 0);
  const dronePosition = camera.position.clone(), droneRotation = camera.quaternion.clone();

  assert.equal(views.select('3v3', 1440, 800, state), true);
  advance(FIELD_CAMERA_TRANSITION_MS);
  assert.ok(camera.position.equals(arenaPosition));
  assert.ok(camera.quaternion.equals(arenaRotation));
  assert.equal(views.select('drone', 1440, 800, state), true);
  advance(FIELD_CAMERA_TRANSITION_MS);
  assert.ok(camera.position.equals(dronePosition));
  assert.ok(camera.quaternion.equals(droneRotation));
});

test('rapid field switches start at the visible pose and preserve unfinished destinations', () => {
  const { camera, views, advance } = createViews();
  views.select('3v3', 1440, 800, state);
  camera.position.set(3, 4, 5);
  camera.lookAt(1, 2, 3);
  const arenaPosition = camera.position.clone(), arenaRotation = camera.quaternion.clone();
  const droneSpawn = defaultFieldCameraPose('drone', 1440, 800, state);

  views.select('drone', 1440, 800, state);
  advance(FIELD_CAMERA_TRANSITION_MS / 3);
  const visiblePosition = camera.position.clone(), visibleRotation = camera.quaternion.clone();
  views.select('dart', 1440, 800, state);
  assert.ok(camera.position.equals(visiblePosition));
  assert.ok(camera.quaternion.equals(visibleRotation));
  advance(FIELD_CAMERA_TRANSITION_MS / 4);
  views.select('drone', 1440, 800, state);
  advance(FIELD_CAMERA_TRANSITION_MS);
  assert.ok(camera.position.equals(droneSpawn.position));
  assert.ok(camera.quaternion.equals(droneSpawn.quaternion));

  views.select('3v3', 1440, 800, state);
  advance(FIELD_CAMERA_TRANSITION_MS);
  assert.ok(camera.position.equals(arenaPosition));
  assert.ok(camera.quaternion.equals(arenaRotation));
});

test('manual takeover stops the transition and preserves the new flight pose', () => {
  const { camera, views, advance } = createViews();
  views.select('3v3', 1440, 800, state);
  views.select('drone', 1440, 800, state);
  advance(FIELD_CAMERA_TRANSITION_MS / 4);
  views.cancelTransition();
  const bounds = fieldCameraBounds('drone', defaultFieldCameraPose('drone', 1440, 800, state).position);
  new CameraFlight(camera, bounds).pan(-200, 100);
  camera.lookAt(0, 1, 0);
  const position = camera.position.clone(), rotation = camera.quaternion.clone();
  assert.equal(advance(FIELD_CAMERA_TRANSITION_MS * 2), false);
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(rotation));

  views.select('sentry', 1440, 800, state);
  advance(FIELD_CAMERA_TRANSITION_MS);
  views.select('drone', 1440, 800, state);
  advance(FIELD_CAMERA_TRANSITION_MS);
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(rotation));
});

test('interrupting a transition outside the destination recovers immediately, without movement input', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    const { camera, views, advance } = createViews();
    views.select(mode === 'drone' ? 'dart' : 'drone', 150, 1200, state);
    views.select(mode, 1440, 800, state);
    advance(FIELD_CAMERA_TRANSITION_MS / 4);
    const bounds = cameraMovementBounds(fieldCameraBounds(mode,
      defaultFieldCameraPose(mode, 1440, 800, state).position));
    assert.ok(!bounds.containsPoint(camera.position), `${mode}: transition starts beyond the barrier`);
    const orientation = camera.quaternion.clone();
    views.cancelTransition();
    assert.ok(bounds.containsPoint(camera.position), `${mode}: manual takeover recovers inside the barrier`);
    assert.ok(camera.quaternion.equals(orientation));
    const position = camera.position.clone();
    assert.equal(advance(FIELD_CAMERA_TRANSITION_MS), false);
    assert.ok(camera.position.equals(position));
    camera.position.toArray().forEach((value, index) => close(camera.matrixWorld.elements[12 + index], value));
  }
});

test('transitions use elapsed time independently of frame rate or prior idle time', () => {
  const run = (steps) => {
    const { camera, views, advance } = createViews();
    views.select('3v3', 1440, 800, state);
    advance(60_000);
    const start = camera.position.clone();
    views.select('dart', 1440, 800, state);
    assert.equal(advance(0), true);
    assert.ok(camera.position.equals(start), 'an idle loop does not skip the transition');
    for (const ms of steps) advance(ms);
    return camera;
  };
  const singleFrame = run([FIELD_CAMERA_TRANSITION_MS / 2]);
  const manyFrames = run(Array(40).fill(FIELD_CAMERA_TRANSITION_MS / 80));
  close(singleFrame.position.distanceTo(manyFrames.position), 0);
  assert.ok(singleFrame.quaternion.angleTo(manyFrames.quaternion) < 1e-7);
});

test('rerendering during a transition preserves its timing and respects tighter destination limits', () => {
  const { camera, views, advance } = createViews();
  views.select('3v3', 1440, 800, state);
  views.select('dart', 1440, 800, state);
  advance(FIELD_CAMERA_TRANSITION_MS / 4);
  const position = camera.position.clone(), rotation = camera.quaternion.clone();
  const nextState = { ...state, zoom: 2 };
  assert.equal(views.select('dart', 700, 1000, nextState), false);
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(rotation));
  assert.equal(advance(FIELD_CAMERA_TRANSITION_MS * 3 / 4), false);
  const target = defaultFieldCameraPose('dart', 1440, 800, state);
  const bounds = cameraMovementBounds(fieldCameraBounds('dart', defaultFieldCameraPose('dart', 700, 1000, nextState).position));
  target.position.clamp(bounds.min, bounds.max);
  assert.ok(camera.position.equals(target.position));
  assert.ok(camera.quaternion.equals(target.quaternion));
});

test('resizing or rerendering a field preserves the active camera position and orientation', () => {
  const camera = new PerspectiveCamera();
  const views = new FieldCameraViews(camera);
  views.select('sentry', 1440, 800, state);
  camera.position.set(5, 3, 4);
  camera.lookAt(1, 1, 0);
  const position = camera.position.clone(), rotation = camera.quaternion.clone();
  assert.equal(views.select('sentry', 700, 1000, state), false);
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(rotation));
});

test('widening the viewport brings a distant portrait pose back within the tighter limits', () => {
  const { camera, views } = createViews();
  views.select('3v3', 400, 1000, state);
  const orientation = camera.quaternion.clone();
  const bounds = fieldCameraBounds('3v3', defaultFieldCameraPose('3v3', 1440, 800, state).position);
  assert.ok(!bounds.containsPoint(camera.position));
  assert.equal(views.select('3v3', 1440, 800, state), true);
  assert.ok(bounds.containsPoint(camera.position));
  assert.ok(camera.quaternion.equals(orientation));
});

test('resizing at a corner preserves clearance and still allows flight toward the field', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    const { camera, views } = createViews();
    views.select(mode, 400, 1000, state);
    const portrait = fieldCameraBounds(mode, defaultFieldCameraPose(mode, 400, 1000, state).position);
    camera.position.copy(portrait.max);
    const orientation = camera.quaternion.clone();
    assert.equal(views.select(mode, 1440, 800, state), true);
    const barrierBounds = fieldCameraBounds(mode, defaultFieldCameraPose(mode, 1440, 800, state).position);
    const bounds = cameraMovementBounds(barrierBounds);
    assert.ok(bounds.containsPoint(camera.position), `${mode}: resize recovers clear of the barrier`);
    assert.ok(camera.quaternion.equals(orientation));
    const center = bounds.getCenter(new Vector3());
    const start = camera.position.clone();
    camera.lookAt(center);
    assert.equal(new CameraFlight(camera, barrierBounds).move(new Set(['forward']), 0.1), true);
    assert.ok(camera.position.distanceTo(center) < start.distanceTo(center));
  }
});
