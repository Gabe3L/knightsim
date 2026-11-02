import { Group, InstancedMesh, Line, LOD, Mesh, Points, SkinnedMesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
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
  && !(mesh instanceof InstancedMesh)
  && mesh.geometry.drawRange.start === 0
  && mesh.geometry.drawRange.count === Infinity
  && !Array.isArray(mesh.material)
  && !mesh.material.transparent
  && mesh.geometry.getAttribute('position') !== undefined
  && Object.keys(mesh.geometry.morphAttributes).length === 0
  && mesh.matrixWorld.determinant() >= 0
);

const cloneUnoptimized = (
  source: Object3D,
  sourceMeshCount: number,
  sourceTriangleCount: number,
): PreparedRobotModel => {
  const object = new Group();
  object.add(cloneSkeleton(source));
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

const hierarchyModels = new WeakMap<Object3D, PreparedRobotModel>();

/**
 * Flattens a static GLB hierarchy and merges compatible primitives by material.
 * CAD exports commonly contain tens of thousands of tiny primitives; drawing the
 * same geometry in a few material batches is dramatically cheaper on every GPU.
 */
export function prepareRobotModel(source: Object3D, preserveHierarchy = false): PreparedRobotModel {
  const cache = preserveHierarchy ? hierarchyModels : preparedModels;
  const cached = cache.get(source);
  if (cached) return cached;

  const startedAt = performance.now();
  const buckets = new Map<string, GeometryBucket>();
  let sourceMeshCount = 0;
  let sourceTriangleCount = 0;
  let mergeSupported = !preserveHierarchy;

  source.updateWorldMatrix(true, true);
  // Preflight before cloning any geometry: one unsupported primitive should not
  // trigger a large temporary allocation for an assembly that cannot be merged.
  source.traverseVisible((child) => {
    if (child instanceof Line || child instanceof Points || child instanceof LOD) mergeSupported = false;
    if (!(child instanceof Mesh)) return;
    sourceMeshCount += 1;
    sourceTriangleCount += triangleCount(child.geometry) * (child instanceof InstancedMesh ? child.count : 1);
    if (!canMergeMesh(child)) mergeSupported = false;
  });
  if (!mergeSupported || sourceMeshCount === 0) {
    const fallback = cloneUnoptimized(source, sourceMeshCount, sourceTriangleCount);
    cache.set(source, fallback);
    return fallback;
  }

  source.traverseVisible((child) => {
    if (!(child instanceof Mesh) || !canMergeMesh(child)) return;
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
      cache.set(source, fallback);
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
  cache.set(source, prepared);
  console.info('[KnightSim] Prepared robot model for real-time rendering', JSON.stringify({
    sourceMeshes: prepared.sourceMeshCount,
    renderedMeshes: prepared.renderedMeshCount,
    triangles: prepared.triangleCount,
    preparationMs: Math.round(performance.now() - startedAt),
  }));
  return prepared;
}
