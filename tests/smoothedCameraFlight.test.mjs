import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { loadTypeScript } from './loadTypeScript.mjs';

const { SmoothedCameraFlight } = await loadTypeScript(new URL('../src/camera/SmoothedCameraFlight.ts', import.meta.url));
const { CameraFlight } = await loadTypeScript(new URL('../src/camera/CameraFlight.ts', import.meta.url));
const { fieldCameraBounds, cameraMovementBounds } = await loadTypeScript(new URL('../src/camera/CameraFlightBounds.ts', import.meta.url));
const { FIELD_SPECS } = await loadTypeScript(new URL('../src/field/fieldSpec.ts', import.meta.url));
const idle = new Set();
const forward = new Set(['forward']);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

function setup(mode = '3v3') {
  const camera = new PerspectiveCamera();
  camera.position.y = 2;
  const bounds = fieldCameraBounds(mode);
  return { camera, bounds: cameraMovementBounds(bounds), flight: new SmoothedCameraFlight(camera, bounds) };
}

function settle(flight) {
  for (let frame = 0; frame < 120; frame++) {
    if (!flight.update(idle, 1 / 60)) return;
  }
  assert.fail('easing must finish so the demand-render loop can go idle');
}

test('small look, pan and scroll inputs ease across frames and reach the full requested pose', () => {
  for (const [method, args] of [['look', [4, -3]], ['pan', [4, -3]], ['dolly', [0.1]]]) {
    const { camera, flight } = setup();
    const start = camera.clone();
    const expected = camera.clone();
    new CameraFlight(expected, fieldCameraBounds('3v3'))[method](...args);
    flight[method](...args);
    assert.ok(camera.position.equals(start.position), `${method}: no event-time position jump`);
    assert.ok(camera.quaternion.equals(start.quaternion), `${method}: no event-time rotation jump`);
    assert.equal(flight.update(idle, 1 / 60), true);
    if (method === 'look') {
      const fullAngle = start.quaternion.angleTo(expected.quaternion);
      const firstAngle = start.quaternion.angleTo(camera.quaternion);
      assert.ok(firstAngle > 0 && firstAngle < fullAngle * 0.4);
    } else {
      const fullDistance = start.position.distanceTo(expected.position);
      const firstDistance = start.position.distanceTo(camera.position);
      assert.ok(firstDistance > 0 && firstDistance < fullDistance * 0.4);
    }
    settle(flight);
    assert.ok(camera.position.equals(expected.position));
    assert.ok(camera.quaternion.equals(expected.quaternion));
    assert.equal(flight.update(idle, 1 / 60), false);
  }
});

test('a short keyboard tap accelerates gently and eases to a stop without losing travel', () => {
  const { camera, flight } = setup();
  assert.equal(flight.update(forward, 0), true, 'a zero-time first frame still schedules flight');
  close(camera.position.z, 0);
  assert.equal(flight.update(forward, 1 / 60), true);
  const firstDistance = -camera.position.z;
  assert.ok(firstDistance > 0 && firstDistance < 0.025, 'the first frame is gentler than full-speed flight');
  assert.equal(flight.update(idle, 1 / 60), true);
  assert.ok(-camera.position.z > firstDistance, 'release finishes the tap smoothly');
  settle(flight);
  close(camera.position.z, -5 / 60);
});

test('easing and keyboard acceleration are consistent across display refresh rates', () => {
  const run = (hz) => {
    const { camera, flight } = setup();
    flight.look(12, -5);
    flight.pan(8, 3);
    flight.dolly(0.2);
    for (let frame = 0; frame < hz / 2; frame++) flight.update(forward, 1 / hz);
    return { camera, flight };
  };
  const slow = run(30), fast = run(144);
  assert.ok(slow.camera.position.distanceTo(fast.camera.position) < 1e-9);
  assert.ok(slow.camera.quaternion.angleTo(fast.camera.quaternion) < 1e-7);
  settle(slow.flight);
  settle(fast.flight);
  assert.ok(slow.camera.position.distanceTo(fast.camera.position) < 1e-9);
});

test('successive small inputs accumulate and reversing direction does not discard input', () => {
  const { camera, flight } = setup();
  for (let i = 0; i < 10; i++) {
    flight.dolly(0.01);
    flight.update(idle, 1 / 120);
  }
  flight.dolly(-0.03);
  settle(flight);
  close(camera.position.z, -0.07);
});

test('smoothed input stays within every field boundary and can retreat after pushing against a wall', () => {
  for (const mode of Object.keys(FIELD_SPECS)) {
    const { camera, bounds, flight } = setup(mode);
    for (const [method, args] of [
      ['pan', [1e6, -1e6]], ['pan', [-2e6, 2e6]],
      ['dolly', [1e6]], ['dolly', [-2e6]],
    ]) {
      flight[method](...args);
      for (let frame = 0; frame < 120; frame++) {
        const pending = flight.update(idle, 1 / 60);
        assert.ok(bounds.containsPoint(camera.position), `${mode}: ${method} stays inside bounds`);
        if (!pending) break;
        assert.ok(frame < 119, `${mode}: ${method} settles`);
      }
    }
    close(camera.position.z, bounds.max.z);
    flight.dolly(0.1);
    flight.update(idle, 1 / 60);
    assert.ok(camera.position.z < bounds.max.z, `${mode}: retreat responds on the next frame`);
    settle(flight);
    close(camera.position.z, bounds.max.z - 0.1);
  }
});

test('stopping drops unfinished input and the next interaction starts at the live camera pose', () => {
  const { camera, flight } = setup();
  flight.look(20, 10);
  flight.dolly(2);
  flight.update(idle, 1 / 60);
  flight.stop();
  const stoppedPosition = camera.position.clone(), stoppedRotation = camera.quaternion.clone();
  assert.equal(flight.update(idle, 60), false);
  assert.ok(camera.position.equals(stoppedPosition));
  assert.ok(camera.quaternion.equals(stoppedRotation));

  camera.position.set(1, 3, 2);
  camera.lookAt(0, 3, 2);
  const expected = camera.position.clone().addScaledVector(camera.getWorldDirection(new Vector3()), 0.1);
  flight.dolly(0.1);
  settle(flight);
  assert.ok(camera.position.distanceTo(expected) < 1e-9);
});

test('an idle controller preserves external camera transitions until manual input begins', () => {
  const { camera, bounds, flight } = setup();
  camera.position.copy(bounds.max).addScalar(10);
  assert.equal(flight.update(idle, 1 / 60), false);
  assert.ok(!bounds.containsPoint(camera.position));
  flight.look(1, 0);
  assert.ok(bounds.containsPoint(camera.position), 'manual takeover recovers inside the boundary immediately');
  settle(flight);
});
