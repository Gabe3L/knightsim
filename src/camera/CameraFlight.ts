import { Camera, Euler, Vector3 } from 'three';
import type { FieldCameraAction } from '../keybindings';

const SPEED_MPS = 5;
const LOOK_RADIANS_PER_PIXEL = 0.003;
const PAN_METRES_PER_PIXEL = 0.01;
const MAX_PITCH = Math.PI / 2 - 0.001;

/** Camera-local flight with world-up elevation, without an orbit target or field bounds. */
export class CameraFlight {
  private readonly direction = new Vector3();
  private readonly movement = new Vector3();
  private readonly rotation = new Euler(0, 0, 0, 'YXZ');

  constructor(private readonly camera: Camera) {}

  move(actions: ReadonlySet<FieldCameraAction>, deltaS: number): boolean {
    if (!Number.isFinite(deltaS) || deltaS <= 0) return false;
    const right = Number(actions.has('right')) - Number(actions.has('left'));
    const forward = Number(actions.has('forward')) - Number(actions.has('back'));
    const up = Number(actions.has('up')) - Number(actions.has('down'));
    this.movement.set(right, 0, -forward).applyQuaternion(this.camera.quaternion);
    this.movement.y += up;
    if (this.movement.lengthSq() < 1e-12) return false;
    this.camera.position.add(this.movement.normalize().multiplyScalar(SPEED_MPS * Math.min(deltaS, 0.1)));
    return true;
  }

  look(deltaX: number, deltaY: number): void {
    this.rotation.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.rotation.y -= deltaX * LOOK_RADIANS_PER_PIXEL;
    this.rotation.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH,
      this.rotation.x - deltaY * LOOK_RADIANS_PER_PIXEL));
    this.rotation.z = 0;
    this.camera.quaternion.setFromEuler(this.rotation);
  }

  pan(deltaX: number, deltaY: number): void {
    this.direction.set(-deltaX, deltaY, 0).applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(this.direction, PAN_METRES_PER_PIXEL);
  }

  dolly(distanceM: number): void {
    this.camera.getWorldDirection(this.direction);
    this.camera.position.addScaledVector(this.direction, distanceM);
  }
}
