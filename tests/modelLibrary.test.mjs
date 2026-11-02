import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';
const { normalizeModelLibrary, normalizeOrientation, serializeModelOperation } = await loadTypeScript(new URL('../electron/modelLibrary.cts', import.meta.url));
const model = { id: '1b25cddd-7133-4cd7-8c7d-c5f0e4d28f70', name: 'Robot', sourceFileName: 'robot.glb', sizeBytes: 20, importedAt: '2026-11-01' };

test('legacy libraries migrate and new robot slots preserve existing assignments', () => {
  const legacy = normalizeModelLibrary({ version: 1, activeModelId: model.id, models: [model] });
  assert.equal(legacy.modelIdByRobot.infantry, model.id);
  assert.equal(legacy.models[0].orientation.scale, 1);
  const next = normalizeModelLibrary({ version: 2, modelIdByRobot: { infantry: model.id, hero: null, 'future-robot': model.id }, models: [model] });
  assert.equal(next.modelIdByRobot.infantry, model.id);
  assert.equal(next.modelIdByRobot.hero, null);
  assert.equal(next.modelIdByRobot.drone, null);
  assert.equal(next.modelIdByRobot['future-robot'], model.id);
});

test('corrupt or future libraries fail closed instead of being overwritten as empty', () => {
  for (const value of [null, [], {}, { version: 2, models: [model] }, { version: 3, models: [] }, { models: [{}] }, { models: [model, model] }]) {
    assert.throws(() => normalizeModelLibrary(value));
  }
  const library = normalizeModelLibrary({ models: [], modelIdByRobot: { drone: 'missing' } });
  assert.equal(library.modelIdByRobot.drone, null);
});

test('non-finite transforms normalize safely while preserving valid CAD scale', () => {
  assert.equal(normalizeOrientation({ scale: 0.001 }).scale, 0.001);
  for (const scale of [NaN, Infinity, -1, 0]) assert.equal(normalizeOrientation({ scale }).scale, 1);
  assert.deepEqual(normalizeOrientation({ rotationDeg: { x: -90, y: Infinity, z: 450 } }).rotationDeg, { x: 270, y: 0, z: 90 });
});

test('concurrent model transactions cannot lose writes, and failures do not stall the queue', async () => {
  let state = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const first = serializeModelOperation(async () => { const value = state; await gate; state = value + 1; });
  const failed = serializeModelOperation(async () => { throw new Error('import failed'); });
  const rejection = assert.rejects(failed, /import failed/);
  const last = serializeModelOperation(async () => { state += 1; });
  release();
  await Promise.all([first, rejection, last]);
  assert.equal(state, 2);
});
