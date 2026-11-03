import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { loadTypeScript } from './loadTypeScript.mjs';

const { CameraFlight } = await loadTypeScript(new URL('../src/camera/CameraFlight.ts', import.meta.url));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const vectorClose = (actual, expected) => actual.toArray().forEach((value, index) => close(value, expected[index]));

test('mouse look rotates in place and flight follows the new direction', () => {
  const camera = new PerspectiveCamera();
  camera.position.set(12, 3, -9);
  const flight = new CameraFlight(camera);
  flight.look(-Math.PI / 2 / 0.003, 0);
  vectorClose(camera.position, [12, 3, -9]);
  vectorClose(camera.getWorldDirection(new Vector3()), [-1, 0, 0]);
  flight.move(new Set(['forward']), 0.1);
  vectorClose(camera.position, [11.5, 3, -9]);
  flight.move(new Set(['right']), 0.1);
  vectorClose(camera.position, [11.5, 3, -9.5]);
});

test('flight can travel below and far outside the field without changing orientation', () => {
  const camera = new PerspectiveCamera();
  camera.position.set(1000, -5, 2000);
  camera.lookAt(1001, -4, 2000);
  const orientation = camera.quaternion.clone();
  const forward = camera.getWorldDirection(new Vector3());
  const start = camera.position.clone();
  const flight = new CameraFlight(camera);
  for (let i = 0; i < 100; i++) flight.move(new Set(['forward']), 0.1);
  close(camera.position.distanceTo(start.clone().addScaledVector(forward, 50)), 0);
  assert.ok(camera.quaternion.equals(orientation));
  flight.move(new Set(['down']), 0.1);
  close(camera.position.y, start.y + forward.y * 50 - 0.5);
});

test('diagonal flight has the same speed, opposing keys cancel, and frame pauses are capped', () => {
  const camera = new PerspectiveCamera();
  const flight = new CameraFlight(camera);
  flight.move(new Set(['forward', 'right', 'up']), 0.1);
  close(camera.position.length(), 0.5);
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
  const flight = new CameraFlight(camera);
  flight.look(0, -100000);
  assert.ok(camera.getWorldDirection(new Vector3()).y > 0.999);
  flight.move(new Set(['forward']), 0.1);
  assert.ok(camera.position.y > 0.49);
  flight.look(0, 100000);
  assert.ok(camera.getWorldDirection(new Vector3()).y < -0.999);
  flight.look(100, 0);
  assert.ok(camera.up.equals(new Vector3(0, 1, 0)));
  close(camera.quaternion.length(), 1);
});

test('scroll crosses the old orbit target and pan stays in the view plane', () => {
  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, 2);
  const flight = new CameraFlight(camera);
  flight.dolly(10);
  vectorClose(camera.position, [0, 0, -8]);
  flight.dolly(-100);
  vectorClose(camera.position, [0, 0, 92]);
  flight.look(-Math.PI / 2 / 0.003, 0);
  const start = camera.position.clone();
  const direction = camera.getWorldDirection(new Vector3());
  const orientation = camera.quaternion.clone();
  flight.pan(50, 25);
  close(camera.position.clone().sub(start).dot(direction), 0);
  close(camera.position.y, 0.25);
  assert.ok(camera.quaternion.equals(orientation));
});
