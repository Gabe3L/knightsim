import { Box3, Euler, Matrix4, Mesh, Quaternion, Vector3, type Object3D } from 'three';
import type { RobotModelOrientation } from '../types';

/** World-axis bounds after the same rotation, flips and uniform scale as the viewer. */
export function modelDimensions(scene: Object3D, orientation: RobotModelOrientation): Vector3 {
  const { rotationDeg, flipped, scale = 1 } = orientation;
  const transform = new Matrix4().compose(new Vector3(), new Quaternion().setFromEuler(new Euler(
    rotationDeg.x * Math.PI / 180, rotationDeg.y * Math.PI / 180, rotationDeg.z * Math.PI / 180,
  )), new Vector3(flipped.x ? -scale : scale, flipped.y ? -scale : scale, flipped.z ? -scale : scale));
  const bounds = new Box3();
  const matrix = new Matrix4();
  scene.updateWorldMatrix(true, true);
  scene.traverseVisible((child) => {
    if (!(child instanceof Mesh)) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    if (child.geometry.boundingBox) {
      matrix.multiplyMatrices(transform, child.matrixWorld);
      bounds.union(child.geometry.boundingBox.clone().applyMatrix4(matrix));
    }
  });
  return bounds.getSize(new Vector3());
}
