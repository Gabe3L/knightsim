import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';

const source = await readFile(new URL('./modelDimensions.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const moduleSource = outputText.replace("from 'three'", `from '${import.meta.resolve('three')}'`);
const { modelDimensions } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
const orientation = { scale: 0.001, rotationDeg: { x: 0, y: 0, z: 0 }, flipped: { x: false, y: false, z: false } };
const close = (actual, expected) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9));

test('converts millimetre geometry to metres without changing the source', () => {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(650, 660, 768), new MeshBasicMaterial()));
  close(modelDimensions(scene, orientation).toArray(), [0.65, 0.66, 0.768]);
  close(scene.scale.toArray(), [1, 1, 1]);
});

test('includes node transforms, rotates dimensions and ignores hidden geometry', () => {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(650, 660, 768), new MeshBasicMaterial());
  mesh.scale.set(2, 1, 1);
  mesh.position.set(100, 50, -10);
  scene.add(mesh);
  const hidden = new Group(); hidden.visible = false;
  hidden.add(new Mesh(new BoxGeometry(10000, 10000, 10000), new MeshBasicMaterial()));
  scene.add(hidden);
  close(modelDimensions(scene, { ...orientation, rotationDeg: { x: 0, y: 90, z: 0 }, flipped: { x: true, y: false, z: false } }).toArray(), [0.768, 0.66, 1.3]);
});

test('legacy orientation without scale retains native dimensions', () => {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(2, 3, 4), new MeshBasicMaterial()));
  const { scale, ...legacyOrientation } = orientation;
  close(modelDimensions(scene, legacyOrientation).toArray(), [2, 3, 4]);
});
