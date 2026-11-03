import { Box3, Camera, Vector3 } from 'three';
import type { FieldCameraAction } from '../keybindings';
import { CameraFlight } from './CameraFlight';
import { cameraMovementBounds } from './CameraFlightBounds';

// Reach 95% of a pointer adjustment in about 0.17 seconds; keyboard in 0.21.
const POINTER_RESPONSE_PER_SECOND = 18;
const KEYBOARD_RESPONSE_PER_SECOND = 14;
const POSITION_EPSILON_M = 0.0001;
const ROTATION_EPSILON_RAD = 0.00001;

/** Ease the visible camera toward bounded flight input, including short key taps. */
export class SmoothedCameraFlight {
  private readonly target = new Camera();
  private readonly flight: CameraFlight;
  private readonly bounds: Box3;
  private readonly previousTarget = new Vector3();
  private readonly targetMovement = new Vector3();
  private pending = false;
  private positionResponsePerSecond = POINTER_RESPONSE_PER_SECOND;

  constructor(private readonly camera: Camera, barrierBounds: Box3) {
    this.flight = new CameraFlight(this.target, barrierBounds);
    this.bounds = cameraMovementBounds(barrierBounds);
  }

  look(deltaX: number, deltaY: number): void {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    this.start();
    this.flight.look(deltaX, deltaY);
  }

  pan(deltaX: number, deltaY: number): void {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    this.start();
    this.positionResponsePerSecond = POINTER_RESPONSE_PER_SECOND;
    this.flight.pan(deltaX, deltaY);
  }

  dolly(distanceM: number): void {
    if (!Number.isFinite(distanceM)) return;
    this.start();
    this.positionResponsePerSecond = POINTER_RESPONSE_PER_SECOND;
    this.flight.dolly(distanceM);
  }

  /** Advance easing and report whether the demand-render loop needs another frame. */
  update(actions: ReadonlySet<FieldCameraAction>, deltaS: number): boolean {
    if (!Number.isFinite(deltaS) || deltaS < 0) return this.pending;
    if (actions.size > 0) this.start();
    if (!this.pending) return false;
    if (deltaS === 0) return true;

    const step = Math.min(deltaS, 0.1);
    this.previousTarget.copy(this.target.position);
    const keyboardMoved = this.flight.move(actions, step);
    if (keyboardMoved) this.positionResponsePerSecond = KEYBOARD_RESPONSE_PER_SECOND;
    this.targetMovement.subVectors(this.target.position, this.previousTarget);
    const positionBlend = -Math.expm1(-this.positionResponsePerSecond * step);
    const lookBlend = -Math.expm1(-POINTER_RESPONSE_PER_SECOND * step);
    // Integrate a moving keyboard target over the frame, so the acceleration
    // and travel distance do not depend on the display's refresh rate.
    this.camera.position.lerp(this.previousTarget, positionBlend)
      .addScaledVector(this.targetMovement, 1 - positionBlend / (this.positionResponsePerSecond * step))
      .clamp(this.bounds.min, this.bounds.max);
    this.camera.quaternion.slerp(this.target.quaternion, lookBlend);

    if (this.camera.position.distanceToSquared(this.target.position) < POSITION_EPSILON_M ** 2
      && this.camera.quaternion.angleTo(this.target.quaternion) < ROTATION_EPSILON_RAD) {
      this.camera.position.copy(this.target.position);
      this.camera.quaternion.copy(this.target.quaternion);
      this.pending = false;
    }
    this.camera.updateMatrixWorld();
    return this.pending || keyboardMoved;
  }

  /** Discard unfinished input when focus, the active view, or the field changes. */
  stop(): void {
    this.pending = false;
  }

  private start(): void {
    if (this.pending) return;
    // Read the live pose lazily: field transitions and resize can move it while idle.
    this.camera.position.clamp(this.bounds.min, this.bounds.max);
    this.target.position.copy(this.camera.position);
    this.target.quaternion.copy(this.camera.quaternion);
    this.positionResponsePerSecond = POINTER_RESPONSE_PER_SECOND;
    this.pending = true;
  }
}
