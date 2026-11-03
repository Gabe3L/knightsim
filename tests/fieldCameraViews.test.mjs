import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { loadTypeScript } from './loadTypeScript.mjs';

const { defaultFieldCameraPose, FIELD_CAMERA_FOV, FieldCameraViews } = await loadTypeScript(
  new URL('../src/camera/FieldCameraViews.ts', import.meta.url),
);
const { FIELD_SPECS, fieldWorldX, fieldWorldZ } = await loadTypeScript(new URL('../src/field/fieldSpec.ts', import.meta.url));
const state = { targetXM: 6, targetYM: 4, zoom: 1 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

function cameraAtSpawn(mode, width, height) {
  const camera = new PerspectiveCamera(FIELD_CAMERA_FOV, width / height, 0.05, 250);
  const pose = defaultFieldCameraPose(mode, width, height, state);
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.updateMatrixWorld();
  return camera;
}

test('each spawn shows the actual floor, walls and flight envelope above the timeline', () => {
  for (const [mode, spec] of Object.entries(FIELD_SPECS)) {
    for (const [width, height] of [[700, 1000], [1000, 1000], [1440, 800], [1920, 800], [1280, 520]]) {
      const camera = cameraAtSpawn(mode, width, height);
      const pad = spec.wall?.thicknessM ?? 0;
      const top = mode === 'drone' ? 2.5 : mode === 'dart' ? 2.7 : mode === '3v3' ? 1.5 : 1.2;
      assert.ok(camera.position.y > top, `${mode} should start above the scenery`);
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

test('challenge views place the launch zone and base at equal depth', () => {
  for (const mode of ['drone', 'dart']) {
    const spec = FIELD_SPECS[mode], zone = spec.zones[0];
    const camera = cameraAtSpawn(mode, 1440, 800);
    const base = new Vector3(fieldWorldX(spec.base.xM, mode), 0, fieldWorldZ(spec.base.yM, mode)).applyMatrix4(camera.matrixWorldInverse);
    const launch = new Vector3(fieldWorldX(zone.xM + zone.widthM / 2, mode), 0,
      fieldWorldZ(zone.yM + zone.depthM / 2, mode)).applyMatrix4(camera.matrixWorldInverse);
    close(base.z, launch.z);
  }
});

test('switching fields gives new fields their own spawn and restores prior flight poses', () => {
  const camera = new PerspectiveCamera();
  const views = new FieldCameraViews(camera);
  assert.equal(views.select('3v3', 1440, 800, state), true);
  camera.position.set(3, 4, 5);
  camera.lookAt(1, 2, 3);
  const arenaPosition = camera.position.clone(), arenaRotation = camera.quaternion.clone();

  assert.equal(views.select('drone', 700, 1000, state), true);
  const droneSpawn = defaultFieldCameraPose('drone', 700, 1000, state);
  assert.ok(camera.position.equals(droneSpawn.position));
  assert.ok(camera.quaternion.equals(droneSpawn.quaternion));
  camera.position.set(-30, 7, 10);
  camera.lookAt(-20, 1, 0);
  const dronePosition = camera.position.clone(), droneRotation = camera.quaternion.clone();

  assert.equal(views.select('3v3', 1440, 800, state), true);
  assert.ok(camera.position.equals(arenaPosition));
  assert.ok(camera.quaternion.equals(arenaRotation));
  assert.equal(views.select('drone', 1440, 800, state), true);
  assert.ok(camera.position.equals(dronePosition));
  assert.ok(camera.quaternion.equals(droneRotation));
});

test('resizing or rerendering a field preserves the active camera position and orientation', () => {
  const camera = new PerspectiveCamera();
  const views = new FieldCameraViews(camera);
  views.select('sentry', 1440, 800, state);
  camera.position.set(1000, -5, 2000);
  camera.lookAt(1001, -4, 2000);
  const position = camera.position.clone(), rotation = camera.quaternion.clone();
  assert.equal(views.select('sentry', 700, 1000, state), false);
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(rotation));
});
