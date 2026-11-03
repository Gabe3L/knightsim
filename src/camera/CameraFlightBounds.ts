import { Box3, Vector3 } from 'three';
import { FIELD_SPECS, fieldWorldX, fieldWorldZ } from '../field/fieldSpec';
import type { FieldMode } from '../types';

export const CAMERA_FLOOR_CLEARANCE_M = 0.15;
export const CAMERA_BARRIER_WARNING_M = 1.5;
export const CAMERA_BARRIER_CLEARANCE_M = 0.35;
const EXTRA_FLIGHT_ROOM_M = 0.5;

/** Keep flight close to the field, with just enough extra room for its fitted overview. */
export function fieldCameraBounds(mode: FieldMode, overviewPosition?: Vector3): Box3 {
  const { floor } = FIELD_SPECS[mode];
  const margin = Math.max(1.5, Math.min(floor.widthM, floor.depthM) / 4) + EXTRA_FLIGHT_ROOM_M;
  const bounds = new Box3(
    new Vector3(fieldWorldX(floor.xM + floor.widthM, mode) - margin,
      CAMERA_FLOOR_CLEARANCE_M, fieldWorldZ(floor.yM, mode) - margin),
    new Vector3(fieldWorldX(floor.xM, mode) + margin,
      Math.max(4, Math.min(floor.widthM, floor.depthM)) + EXTRA_FLIGHT_ROOM_M,
      fieldWorldZ(floor.yM + floor.depthM, mode) + margin),
  );
  if (overviewPosition) {
    const clearance = CAMERA_BARRIER_WARNING_M + 0.5 + EXTRA_FLIGHT_ROOM_M;
    // Narrow viewports need a more distant overview. Allow that framing, but
    // only another 2.5 metres of travel beyond it, in either direction.
    bounds.min.x = Math.min(bounds.min.x, -Math.abs(overviewPosition.x) - clearance);
    bounds.max.x = Math.max(bounds.max.x, Math.abs(overviewPosition.x) + clearance);
    bounds.min.z = Math.min(bounds.min.z, -Math.abs(overviewPosition.z) - clearance);
    bounds.max.z = Math.max(bounds.max.z, Math.abs(overviewPosition.z) + clearance);
    bounds.max.y = Math.max(bounds.max.y, overviewPosition.y + clearance);
  }
  return bounds;
}

/** Stop short of the barrier so the camera never sits against its surface. */
export function cameraMovementBounds(barrierBounds: Box3): Box3 {
  const bounds = barrierBounds.clone().expandByScalar(-CAMERA_BARRIER_CLEARANCE_M);
  // The floor already includes its own clearance.
  bounds.min.y = barrierBounds.min.y;
  return bounds;
}

export function cameraBarrierOpacity(distanceM: number): number {
  const proximity = Math.max(0, Math.min(1, 1 - distanceM / CAMERA_BARRIER_WARNING_M));
  return proximity * proximity * (3 - 2 * proximity);
}
