import { Camera, Matrix4, Quaternion, Vector3 } from 'three';
import { FIELD_SPECS, fieldWorldX, fieldWorldZ } from '../field/fieldSpec';
import type { CameraState, FieldMode } from '../types';

export const FIELD_CAMERA_FOV = 43;
export const FIELD_CAMERA_TRANSITION_MS = 800;
const STARTING_ELEVATION_DEG = 22;
const TIMELINE_CLEARANCE_PX = 84;
const WORLD_UP = new Vector3(0, 1, 0);

interface CameraPose {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

interface CameraTransition {
  readonly from: CameraPose;
  readonly to: CameraPose;
  readonly startedAtMs: number;
}

interface ProjectedCorner {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

function fitDistance(corners: readonly ProjectedCorner[], axis: 'x' | 'y', lower: number, upper: number): number {
  let distance = 0;
  // Opposite corners must fit between the two sides of the frustum. Solving
  // each pair also lets us center the projected field instead of its floor.
  for (const a of corners) for (const b of corners) {
    distance = Math.max(distance,
      (a[axis] - b[axis] + upper * a.depth + lower * b.depth) / (upper + lower));
  }
  return distance;
}

function fitCenter(corners: readonly ProjectedCorner[], axis: 'x' | 'y', distance: number, lower: number, upper: number): number {
  const min = Math.max(...corners.map((point) => point[axis] - upper * (distance - point.depth)));
  const max = Math.min(...corners.map((point) => point[axis] + lower * (distance - point.depth)));
  return (min + max) / 2;
}

/** An end-corner view of the floor, walls and preview flight height. */
export function defaultFieldCameraPose(mode: FieldMode, width: number, height: number, state: CameraState): CameraPose {
  const spec = FIELD_SPECS[mode];
  const challenge = mode === 'drone' || mode === 'dart';
  // Follow the field diagonal from an end corner. Challenges start at the
  // launch end, looking toward the base along the length of the course.
  const cornerX = challenge ? -spec.size.lengthM : spec.size.lengthM;
  // Keep a side angle on long, narrow courses instead of lining up with the end.
  const sideOffset = Math.max(spec.size.widthM, spec.size.lengthM * 0.5);
  const cornerZ = challenge ? sideOffset : -sideOffset;
  const back = new Vector3(cornerX,
    Math.hypot(cornerX, cornerZ) * Math.tan(STARTING_ELEVATION_DEG * Math.PI / 180), cornerZ).normalize();
  const right = new Vector3().crossVectors(WORLD_UP, back).normalize();
  const up = new Vector3().crossVectors(back, right);
  const pad = spec.wall?.thicknessM ?? 0;
  const top = mode === 'drone' ? 2.5 : mode === 'dart' ? 2.7 : mode === '3v3' ? 1.5 : 1.2;
  const corners: ProjectedCorner[] = [];
  for (const xM of [spec.floor.xM - pad, spec.floor.xM + spec.floor.widthM + pad]) {
    for (const yM of [spec.floor.yM - pad, spec.floor.yM + spec.floor.depthM + pad]) {
      for (const altitude of [0, top]) {
        const point = new Vector3(fieldWorldX(xM, mode), altitude, fieldWorldZ(yM, mode));
        corners.push({ x: point.dot(right), y: point.dot(up), depth: point.dot(back) });
      }
    }
  }
  const safeHeight = Math.max(1, height);
  const vertical = Math.tan(FIELD_CAMERA_FOV * Math.PI / 360);
  const horizontal = vertical * Math.max(0.1, width / safeHeight) * 0.9;
  const upper = vertical * 0.9;
  const lower = vertical * (0.9 - 2 * Math.min(0.3, TIMELINE_CLEARANCE_PX / safeHeight));
  const distance = Math.max(
    fitDistance(corners, 'x', horizontal, horizontal),
    fitDistance(corners, 'y', lower, upper),
    ...corners.map((point) => point.depth + 0.1),
  );
  const target = right.clone().multiplyScalar(fitCenter(corners, 'x', distance, horizontal, horizontal))
    .addScaledVector(up, fitCenter(corners, 'y', distance, lower, upper));
  if (mode === '3v3') target.add(new Vector3(fieldWorldX(state.targetXM, mode), 0, fieldWorldZ(state.targetYM, mode)));
  const position = target.clone().addScaledVector(back, distance / Math.max(0.7, state.zoom));
  const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, WORLD_UP));
  return { position, quaternion };
}

/** Keep one camera alive, remembering a separate free-flight pose per field. */
export class FieldCameraViews {
  private readonly poses = new Map<FieldMode, CameraPose>();
  private currentMode: FieldMode | null = null;
  private transition: CameraTransition | null = null;

  constructor(
    private readonly camera: Camera,
    private readonly now: () => number = () => performance.now(),
  ) {}

  select(mode: FieldMode, width: number, height: number, state: CameraState): boolean {
    if (mode === this.currentMode) return false;
    const from = {
      position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(),
    };
    // A quick switch should remember the field's destination, not a point
    // partway through the journey from the previous field.
    if (this.currentMode) this.poses.set(this.currentMode, this.transition?.to ?? from);
    const pose = this.poses.get(mode) ?? defaultFieldCameraPose(mode, width, height, state);
    if (this.currentMode) {
      this.transition = { from, to: pose, startedAtMs: this.now() };
    } else {
      this.applyPose(pose);
    }
    this.currentMode = mode;
    return true;
  }

  /** Advance the transition and report whether another frame is needed. */
  update(): boolean {
    if (!this.transition) return false;
    const { from, to, startedAtMs } = this.transition;
    // Use time since selection so an idle demand-render loop cannot consume
    // the animation with its first, potentially very large, frame delta.
    const progress = Math.max(0, (this.now() - startedAtMs) / FIELD_CAMERA_TRANSITION_MS);
    if (progress >= 1) {
      this.applyPose(to);
      this.transition = null;
      return false;
    }
    const eased = progress * progress * (3 - 2 * progress);
    this.camera.position.lerpVectors(from.position, to.position, eased);
    this.camera.quaternion.slerpQuaternions(from.quaternion, to.quaternion, eased);
    this.camera.updateMatrixWorld();
    return true;
  }

  /** Manual flight takes over from the current interpolated pose. */
  cancelTransition(): void {
    this.transition = null;
  }

  private applyPose(pose: CameraPose): void {
    this.camera.position.copy(pose.position);
    this.camera.quaternion.copy(pose.quaternion);
    this.camera.updateMatrixWorld();
  }
}
