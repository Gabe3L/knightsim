import { Camera, Matrix4, Quaternion, Vector3 } from 'three';
import { FIELD_SPECS, fieldWorldX, fieldWorldZ } from '../field/fieldSpec';
import type { CameraState, FieldMode } from '../types';

export const FIELD_CAMERA_FOV = 43;
const TIMELINE_CLEARANCE_PX = 84;
const WORLD_UP = new Vector3(0, 1, 0);

interface CameraPose {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
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

/** A padded overview of the actual floor, walls and preview flight height. */
export function defaultFieldCameraPose(mode: FieldMode, width: number, height: number, state: CameraState): CameraPose {
  const spec = FIELD_SPECS[mode];
  const challenge = mode === 'drone' || mode === 'dart';
  // Look across the challenge course so the base and launch zone have similar
  // depth. Arena views are higher to see over the perimeter and central wall.
  const back = new Vector3(...(challenge
    ? [-spec.size.widthM / spec.size.lengthM, 0.85, -1] as const
    : mode === '3v3' ? [0.35, 1.2, -1] as const : [0.65, 1.3, -1] as const)).normalize();
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

  constructor(private readonly camera: Camera) {}

  select(mode: FieldMode, width: number, height: number, state: CameraState): boolean {
    if (mode === this.currentMode) return false;
    if (this.currentMode) this.poses.set(this.currentMode, {
      position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(),
    });
    const pose = this.poses.get(mode) ?? defaultFieldCameraPose(mode, width, height, state);
    this.camera.position.copy(pose.position);
    this.camera.quaternion.copy(pose.quaternion);
    this.camera.updateMatrixWorld();
    this.currentMode = mode;
    return true;
  }
}
