import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { loadTypeScript } from './loadTypeScript.mjs';

const { CameraFlight } = await loadTypeScript(new URL('../src/camera/CameraFlight.ts', import.meta.url));
const { fieldCameraBounds, cameraMovementBounds, cameraBarrierOpacity, CAMERA_BARRIER_CLEARANCE_M, CAMERA_BARRIER_WARNING_M, CAMERA_FLOOR_CLEARANCE_M } = await loadTypeScript(
  new URL('../src/camera/CameraFlightBounds.ts', import.meta.url),
);
const { FIELD_SPECS } = await loadTypeScript(new URL('../src/field/fieldSpec.ts', import.meta.url));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const vectorClose = (actual, expected) => actual.toArray().forEach((value, index) => close(value, expected[index]));

test('mouse look rotates in place and flight follows the new direction', () => {
  const camera = new PerspectiveCamera();
  camera.position.set(5, 3, -4);
  const flight = new CameraFlight(camera, fieldCameraBounds('3v3'));
  flight.look(-Math.PI / 2 / 0.003, 0);
  vectorClose(camera.position, [5, 3, -4]);
  vectorClose(camera.getWorldDirection(new Vector3()), [-1, 0, 0]);
  flight.move(new Set(['forward']), 0.1);
  vectorClose(camera.position, [4.5, 3, -4]);
  flight.move(new Set(['right']), 0.1);
  vectorClose(camera.position, [4.5, 3, -4.5]);
});

test('keyboard flight leaves clearance at every barrier and can always retreat', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    const camera = new PerspectiveCamera();
    const barrierBounds = fieldCameraBounds(mode);
    const bounds = cameraMovementBounds(barrierBounds);
    const flight = new CameraFlight(camera, barrierBounds);
    const orientation = camera.quaternion.clone();
    for (const [action, axis, limit, retreat] of [
      ['down', 'y', bounds.min.y, 'up'], ['up', 'y', bounds.max.y, 'down'],
      ['left', 'x', bounds.min.x, 'right'], ['right', 'x', bounds.max.x, 'left'],
      ['forward', 'z', bounds.min.z, 'back'], ['back', 'z', bounds.max.z, 'forward'],
    ]) {
      camera.position.set(0, 2, 0);
      camera.position[axis] = limit + (['down', 'left', 'forward'].includes(action) ? 0.1 : -0.1);
      assert.equal(flight.move(new Set([action]), 0.1), true);
      close(camera.position[axis], limit);
      assert.equal(flight.move(new Set([action]), 0.1), false, `${mode}: stops at ${action} limit`);
      assert.ok(bounds.containsPoint(camera.position));
      if (action !== 'down') {
        const barrier = ['left', 'forward'].includes(action) ? barrierBounds.min[axis] : barrierBounds.max[axis];
        close(Math.abs(camera.position[axis] - barrier), CAMERA_BARRIER_CLEARANCE_M);
      }
      assert.ok(camera.quaternion.equals(orientation));
      assert.equal(flight.move(new Set([retreat]), 0.1), true, `${mode}: can fly back from ${action} limit`);
      assert.ok(Math.abs(camera.position[axis] - limit) > 0.49);
    }
  }
});

test('diagonal flight has the same speed, opposing keys cancel, and frame pauses are capped', () => {
  const camera = new PerspectiveCamera();
  camera.position.y = 2;
  const origin = camera.position.clone();
  const flight = new CameraFlight(camera, fieldCameraBounds('3v3'));
  flight.move(new Set(['forward', 'right', 'up']), 0.1);
  close(camera.position.distanceTo(origin), 0.5);
  const start = camera.position.clone();
  assert.equal(flight.move(new Set(['forward', 'back', 'left', 'right', 'up', 'down']), 0.1), false);
  assert.ok(camera.position.equals(start));
  assert.equal(flight.move(new Set(), 0.1), false);
  for (const delta of [0, -1, NaN, Infinity]) assert.equal(flight.move(new Set(['forward']), delta), false);
  flight.move(new Set(['forward']), 60);
  close(camera.position.distanceTo(start), 0.5);
});

test('looking up and down is independent of field elevation and stays upright at the poles', () => {
  const camera = new PerspectiveCamera();
  camera.position.y = 2;
  const flight = new CameraFlight(camera, fieldCameraBounds('3v3'));
  flight.look(0, -100000);
  assert.ok(camera.getWorldDirection(new Vector3()).y > 0.999);
  flight.move(new Set(['forward']), 0.1);
  assert.ok(camera.position.y > 2.49);
  flight.look(0, 100000);
  assert.ok(camera.getWorldDirection(new Vector3()).y < -0.999);
  flight.look(100, 0);
  assert.ok(camera.up.equals(new Vector3(0, 1, 0)));
  close(camera.quaternion.length(), 1);
});

test('scroll crosses the old orbit target and pan stays in the view plane inside the boundaries', () => {
  const camera = new PerspectiveCamera();
  camera.position.set(0, 2, 2);
  const flight = new CameraFlight(camera, fieldCameraBounds('3v3'));
  flight.dolly(4);
  vectorClose(camera.position, [0, 2, -2]);
  flight.dolly(-4);
  vectorClose(camera.position, [0, 2, 2]);
  flight.look(-Math.PI / 2 / 0.003, 0);
  const start = camera.position.clone();
  const direction = camera.getWorldDirection(new Vector3());
  const orientation = camera.quaternion.clone();
  flight.pan(50, 25);
  close(camera.position.clone().sub(start).dot(direction), 0);
  close(camera.position.y, 2.25);
  assert.ok(camera.quaternion.equals(orientation));
});

test('panning and large scroll inputs cannot bypass the floor or any outer boundary', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    const camera = new PerspectiveCamera();
    const barrierBounds = fieldCameraBounds(mode);
    const bounds = cameraMovementBounds(barrierBounds);
    const flight = new CameraFlight(camera, barrierBounds);
    camera.position.set(0, 2, 0);
    flight.pan(1e6, -1e6);
    vectorClose(camera.position, [bounds.min.x, CAMERA_FLOOR_CLEARANCE_M, 0]);
    flight.pan(-2e6, 2e6);
    vectorClose(camera.position, [bounds.max.x, bounds.max.y, 0]);
    flight.dolly(1e6);
    close(camera.position.z, bounds.min.z);
    flight.dolly(-2e6);
    close(camera.position.z, bounds.max.z);

    camera.position.set(0, 2, 0);
    flight.look(0, 1e6);
    flight.dolly(1e6);
    close(camera.position.y, bounds.min.y);
    flight.dolly(-2e6);
    close(camera.position.y, bounds.max.y);
    assert.ok(bounds.containsPoint(camera.position));
  }
});

test('pitched flight cannot dive under the field and can slide along a wall', () => {
  const camera = new PerspectiveCamera();
  const barrierBounds = fieldCameraBounds('1v1');
  const bounds = cameraMovementBounds(barrierBounds);
  const flight = new CameraFlight(camera, barrierBounds);
  camera.position.set(0, 0.2, 0);
  flight.look(0, Math.PI / 4 / 0.003);
  flight.move(new Set(['forward']), 0.1);
  close(camera.position.y, CAMERA_FLOOR_CLEARANCE_M);
  assert.ok(camera.position.z < -0.3);

  camera.quaternion.identity();
  camera.position.set(bounds.max.x, 2, 0);
  flight.move(new Set(['right', 'forward']), 0.1);
  close(camera.position.x, bounds.max.x);
  assert.ok(camera.position.z < -0.3);
});

test('looking around recovers a camera stranded beyond any barrier, floor or corner', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    const camera = new PerspectiveCamera();
    const barrierBounds = fieldCameraBounds(mode);
    const bounds = cameraMovementBounds(barrierBounds);
    const flight = new CameraFlight(camera, barrierBounds);
    const center = bounds.getCenter(new Vector3());
    for (const axis of ['x', 'y', 'z']) {
      for (const side of ['min', 'max']) {
        camera.position.copy(center);
        camera.position[axis] = barrierBounds[side][axis] + (side === 'min' ? -10 : 10);
        flight.look(5, -5);
        assert.ok(bounds.containsPoint(camera.position), `${mode}: recovers past ${side}.${axis}`);
      }
    }
    for (const x of [barrierBounds.min.x, barrierBounds.max.x]) {
      for (const y of [barrierBounds.min.y, barrierBounds.max.y]) {
        for (const z of [barrierBounds.min.z, barrierBounds.max.z]) {
          camera.position.set(x, y, z);
          flight.look(0, 0);
          assert.ok(bounds.containsPoint(camera.position), `${mode}: recovers at corners`);
          const start = camera.position.clone();
          camera.lookAt(center);
          assert.equal(flight.move(new Set(['forward']), 0.1), true);
          assert.ok(camera.position.distanceTo(center) < start.distanceTo(center), `${mode}: escapes the corner`);
        }
      }
    }
  }
});

test('the red barrier fades in only within the warning distance and disappears on retreat', () => {
  assert.equal(cameraBarrierOpacity(CAMERA_BARRIER_WARNING_M + 10), 0);
  assert.equal(cameraBarrierOpacity(CAMERA_BARRIER_WARNING_M), 0);
  const approaching = [0.75, 0.5, 0.25, 0].map((fraction) => cameraBarrierOpacity(fraction * CAMERA_BARRIER_WARNING_M));
  assert.ok(approaching.every((opacity, index) => opacity > (approaching[index - 1] ?? 0)));
  assert.equal(approaching.at(-1), 1);
  assert.equal(cameraBarrierOpacity(CAMERA_BARRIER_WARNING_M + 0.1), 0);
});
