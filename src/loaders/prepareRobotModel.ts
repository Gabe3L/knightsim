import { Group, Mesh, SkinnedMesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface GeometryBucket {
  readonly geometries: BufferGeometry[];
  readonly material: Material;
  readonly renderOrder: number;
}

export interface PreparedRobotModel {
  readonly object: Group;
  readonly sourceMeshCount: number;
  readonly renderedMeshCount: number;
  readonly triangleCount: number;
}

const MERGE_CHUNK_SIZE = 512;
const preparedModels = new WeakMap<Object3D, PreparedRobotModel>();

const isEffectivelyVisible = (object: Object3D): boolean => {
  let current: Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
};

const geometryLayoutKey = (geometry: BufferGeometry): string => {
  const attributes = Object.entries(geometry.attributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, attribute]) => [
      name,
      attribute.itemSize,
      attribute.normalized,
      attribute.array.constructor.name,
    ].join(':'))
    .join('|');
  return `${geometry.index ? 'indexed' : 'plain'}:${attributes}`;
};

const triangleCount = (geometry: BufferGeometry): number => {
  const elementCount = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0;
  return Math.floor(elementCount / 3);
};

const canMergeMesh = (mesh: Mesh): mesh is Mesh<BufferGeometry, Material> => (
  !(mesh instanceof SkinnedMesh)
  && !Array.isArray(mesh.material)
  && mesh.geometry.getAttribute('position') !== undefined
  && Object.keys(mesh.geometry.morphAttributes).length === 0
  && mesh.matrixWorld.determinant() >= 0
);

const cloneUnoptimized = (
  source: Object3D,
  sourceMeshCount: number,
  sourceTriangleCount: number,
): PreparedRobotModel => {
  const object = source.clone(true) as Group;
  object.traverse((child) => {
    if (child instanceof Mesh) {
      // Imported CAD assemblies can contain tens of thousands of primitives.
      // Sending all of them through the shadow pass can more than double frame cost.
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  return {
    object,
    sourceMeshCount,
    renderedMeshCount: sourceMeshCount,
    triangleCount: sourceTriangleCount,
  };
};

const mergeBucket = (bucket: GeometryBucket): BufferGeometry | null => {
  const partials: BufferGeometry[] = [];

  for (let start = 0; start < bucket.geometries.length; start += MERGE_CHUNK_SIZE) {
    const sourceChunk = bucket.geometries.slice(start, start + MERGE_CHUNK_SIZE);
    const partial = mergeGeometries(sourceChunk, false);
    sourceChunk.forEach((geometry) => geometry.dispose());
    if (!partial) {
      partials.forEach((geometry) => geometry.dispose());
      return null;
    }
    partials.push(partial);
  }

  if (partials.length === 1) return partials[0]!;
  const merged = mergeGeometries(partials, false);
  partials.forEach((geometry) => geometry.dispose());
  return merged ?? null;
};

/**
 * Flattens a static GLB hierarchy and merges compatible primitives by material.
 * CAD exports commonly contain tens of thousands of tiny primitives; drawing the
 * same geometry in a few material batches is dramatically cheaper on every GPU.
 */
export function prepareRobotModel(source: Object3D): PreparedRobotModel {
  const cached = preparedModels.get(source);
  if (cached) return cached;

  const startedAt = performance.now();
  const buckets = new Map<string, GeometryBucket>();
  let sourceMeshCount = 0;
  let sourceTriangleCount = 0;
  let mergeSupported = true;

  source.updateWorldMatrix(true, true);
  source.traverse((child) => {
    if (!(child instanceof Mesh) || !isEffectivelyVisible(child)) return;
    sourceMeshCount += 1;
    sourceTriangleCount += triangleCount(child.geometry);
    if (!canMergeMesh(child)) {
      mergeSupported = false;
      return;
    }

    const material = child.material;
    const key = `${material.uuid}:${child.renderOrder}:${geometryLayoutKey(child.geometry)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { geometries: [], material, renderOrder: child.renderOrder };
      buckets.set(key, bucket);
    }

    // Bake the GLB node transform into each primitive. The resulting shallow
    // hierarchy avoids updating thousands of world matrices for every replay frame.
    bucket.geometries.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
  });

  if (!mergeSupported || buckets.size === 0) {
    buckets.forEach((bucket) => bucket.geometries.forEach((geometry) => geometry.dispose()));
    const fallback = cloneUnoptimized(source, sourceMeshCount, sourceTriangleCount);
    preparedModels.set(source, fallback);
    return fallback;
  }

  const object = new Group();
  object.name = `${source.name || 'robot-model'}-optimized`;
  for (const bucket of buckets.values()) {
    const geometry = mergeBucket(bucket);
    if (!geometry) {
      buckets.forEach((remainingBucket) => (
        remainingBucket.geometries.forEach((remainingGeometry) => remainingGeometry.dispose())
      ));
      object.traverse((child) => {
        if (child instanceof Mesh) child.geometry.dispose();
      });
      const fallback = cloneUnoptimized(source, sourceMeshCount, sourceTriangleCount);
      preparedModels.set(source, fallback);
      return fallback;
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, bucket.material);
    mesh.renderOrder = bucket.renderOrder;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    object.add(mesh);
  }

  const prepared: PreparedRobotModel = {
    object,
    sourceMeshCount,
    renderedMeshCount: object.children.length,
    triangleCount: sourceTriangleCount,
  };
  preparedModels.set(source, prepared);
  console.info('[KnightSim] Prepared robot model for real-time rendering', JSON.stringify({
    sourceMeshes: prepared.sourceMeshCount,
    renderedMeshes: prepared.renderedMeshCount,
    triangles: prepared.triangleCount,
    preparationMs: Math.round(performance.now() - startedAt),
  }));
  return prepared;
}
