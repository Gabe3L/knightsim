import assert from 'node:assert/strict';
import test from 'node:test';
import { Bone, Box3, BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Line, Matrix4, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { loadTypeScript } from './loadTypeScript.mjs';
const { prepareRobotModel } = await loadTypeScript(new URL('../src/loaders/prepareRobotModel.ts', import.meta.url));
const { modelDimensions } = await loadTypeScript(new URL('../src/loaders/modelDimensions.ts', import.meta.url));
const orientation = { scale: 1, rotationDeg: { x: 0, y: 0, z: 0 }, flipped: { x: false, y: false, z: false } };
const material = new MeshBasicMaterial();
const meshes = (object) => { const result = []; object.traverse((child) => { if (child.isMesh) result.push(child); }); return result; };

test('CAD batching reduces draw meshes and preserves transformed geometry and source ownership', () => {
  const source = new Group();
  for (let i = 0; i < 20; i++) {
    const mesh = new Mesh(new BoxGeometry(1, 2, 3), material);
    mesh.position.set(i * 2, 1, -3);
    source.add(mesh);
  }
  const before = new Box3().setFromObject(source);
  const prepared = prepareRobotModel(source);
  assert.equal(prepared.sourceMeshCount, 20);
  assert.equal(prepared.renderedMeshCount, 1);
  assert.ok(new Box3().setFromObject(prepared.object).equals(before));
  assert.equal(source.children.length, 20);
  assert.equal(source.children[0].parent, source);
  assert.equal(prepareRobotModel(source), prepared);
});

test('instanced parts keep all instances and dimensions include their transforms', () => {
  const source = new Group();
  const instances = new InstancedMesh(new BoxGeometry(1, 2, 3), material, 2);
  instances.setMatrixAt(0, new Matrix4().makeTranslation(0, 0, 0));
  instances.setMatrixAt(1, new Matrix4().makeTranslation(10, 0, 0));
  source.add(instances);
  const result = meshes(prepareRobotModel(source).object)[0];
  assert.ok(result.isInstancedMesh);
  assert.equal(result.count, 2);
  assert.deepEqual(modelDimensions(source, orientation).toArray(), [11, 2, 3]);
});

test('skeleton clones own their bones and deformed dimensions match the pose', () => {
  const geometry = new BoxGeometry(1, 2, 3);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  const source = new Group();
  const mesh = new SkinnedMesh(geometry, material);
  const bone = new Bone();
  mesh.add(bone); mesh.bind(new Skeleton([bone])); source.add(mesh);
  bone.scale.set(2, 1, 1); source.updateMatrixWorld(true);
  const copied = meshes(prepareRobotModel(source).object)[0];
  assert.notEqual(copied.skeleton.bones[0], bone);
  assert.equal(copied.skeleton.bones[0].parent, copied);
  assert.deepEqual(modelDimensions(source, orientation).toArray(), [2, 2, 3]);
});

test('partial draws, transparent primitives, and animated nodes are not flattened', () => {
  for (const kind of ['partial', 'transparent', 'animated']) {
    const source = new Group();
    const mesh = new Mesh(new BoxGeometry(), kind === 'transparent' ? new MeshBasicMaterial({ transparent: true }) : material);
    mesh.name = 'moving-joint'; source.add(mesh);
    if (kind === 'partial') mesh.geometry.setDrawRange(0, 3);
    const result = prepareRobotModel(source, kind === 'animated').object;
    assert.ok(result.getObjectByName('moving-joint'));
    if (kind === 'partial') assert.equal(meshes(result)[0].geometry.drawRange.count, 3);
  }
});

test('non-mesh primitives survive alongside a mesh', () => {
  const source = new Group();
  source.add(new Mesh(new BoxGeometry(), material));
  const line = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3(1, 0, 0)]));
  line.name = 'sensor-ray'; source.add(line);
  assert.ok(prepareRobotModel(source).object.getObjectByName('sensor-ray').isLine);
});
