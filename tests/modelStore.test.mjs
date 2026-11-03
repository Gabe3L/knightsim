import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';

const { RobotModelStore } = await loadTypeScript(new URL('../electron/modelStore.cts', import.meta.url));

function glb(label = 'Robot') {
  const json = JSON.stringify({ asset: { version: '2.0' }, scenes: [{ name: label }] });
  const payload = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4));
  const buffer = Buffer.alloc(20 + payload.length);
  buffer.write('glTF');
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(payload.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  payload.copy(buffer, 20);
  return buffer;
}

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'knightsim-model-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const defaultDirectory = path.join(root, 'models');
  const customDirectory = path.join(root, 'custom models');
  const settingsPath = path.join(root, 'app-data', 'library.json');
  await mkdir(defaultDirectory);
  await mkdir(customDirectory);
  const createStore = () => new RobotModelStore(defaultDirectory, settingsPath);
  return { defaultDirectory, customDirectory, settingsPath, createStore, store: createStore() };
}

test('startup discovers models in ./models and serves source files without copying binaries', async (t) => {
  const { store, defaultDirectory, settingsPath, createStore } = await fixture(t);
  const sourcePath = path.join(defaultDirectory, 'Infantry.glb');
  const source = glb();
  await writeFile(sourcePath, source);
  const library = await store.list();
  assert.equal(library.version, 3);
  assert.equal(library.directory, defaultDirectory);
  assert.equal(library.isDefaultDirectory, true);
  assert.equal(library.directoryMissing, false);
  assert.equal(library.models.length, 1);
  const model = library.models[0];
  assert.equal(model.name, 'Infantry');
  assert.equal(await store.resolveModel(model.id), sourcePath);
  assert.equal(await store.resolveModel('../Outside'), null);
  assert.equal(library.modelIdByRobot.infantry, null);
  await store.setForRobot('infantry', model.id);
  const restored = await createStore().list();
  assert.equal(restored.modelIdByRobot.infantry, model.id);
  assert.deepEqual(await readdir(path.dirname(settingsPath)), ['library.json']);
  assert.deepEqual(await readFile(sourcePath), source);
  await assert.rejects(store.setForRobot('missing-robot', model.id), /Invalid robot/);
  await assert.rejects(store.setForRobot('infantry', 'unknown'), /no longer available/);
  const cleared = await store.setForRobot('infantry', null);
  assert.equal(cleared.modelIdByRobot.infantry, null);
  assert.deepEqual(await readFile(sourcePath), source);
});

test('chosen folders persist, isolate identical filenames, and restore assignments and transforms on return', async (t) => {
  const { store, defaultDirectory, customDirectory, createStore } = await fixture(t);
  await writeFile(path.join(defaultDirectory, 'Robot.glb'), glb('Default'));
  await writeFile(path.join(customDirectory, 'Robot.glb'), glb('Custom'));
  const initial = await store.list();
  const original = initial.models[0];
  await store.setForRobot('hero', original.id);
  const orientation = { scale: 0.001, rotationDeg: { x: 90, y: 0, z: 270 }, flipped: { x: false, y: true, z: false } };
  await store.updateOrientation(original.id, orientation);
  const custom = await store.setDirectory(customDirectory);
  assert.equal(custom.isDefaultDirectory, false);
  assert.notEqual(custom.models[0].id, original.id);
  assert.equal(custom.modelIdByRobot.hero, null);
  assert.equal(custom.models[0].orientation.scale, 1);
  assert.equal(await store.resolveModel(original.id), null);
  await store.setForRobot('drone', custom.models[0].id);
  const restarted = createStore();
  const restoredCustom = await restarted.list();
  assert.equal(restoredCustom.directory, customDirectory);
  assert.equal(restoredCustom.modelIdByRobot.drone, custom.models[0].id);
  const reset = await restarted.setDirectory(null);
  assert.equal(reset.directory, defaultDirectory);
  assert.equal(reset.isDefaultDirectory, true);
  assert.equal(reset.modelIdByRobot.hero, original.id);
  assert.deepEqual(reset.models[0].orientation, orientation);
  const returned = await restarted.setDirectory(customDirectory);
  assert.equal(returned.modelIdByRobot.drone, custom.models[0].id);
});

test('refresh detects new, changed, invalid and removed files, and recovers assignments when files return', async (t) => {
  const { store, defaultDirectory, createStore } = await fixture(t);
  const source = path.join(defaultDirectory, 'Robot.glb');
  await writeFile(source, glb());
  const initial = (await store.list()).models[0];
  await store.setForRobot('sentry', initial.id);
  await writeFile(source, glb('Updated robot'));
  await utimes(source, new Date('2026-11-03'), new Date('2026-11-03'));
  await writeFile(path.join(defaultDirectory, 'Drone.GLB'), glb('Drone'));
  await writeFile(path.join(defaultDirectory, 'Broken.glb'), 'invalid');
  await writeFile(path.join(defaultDirectory, 'readme.txt'), 'notes');
  const refreshed = await store.list();
  assert.equal(refreshed.models.length, 2);
  const changed = refreshed.models.find((model) => model.id === initial.id);
  assert.notEqual(changed.revision, initial.revision);
  assert.equal(refreshed.modelIdByRobot.sentry, initial.id);
  assert.equal(refreshed.issues.length, 1);
  assert.equal(refreshed.issues[0].fileName, 'Broken.glb');
  await rm(source);
  assert.equal(await store.resolveModel(initial.id), null);
  assert.equal((await store.list()).modelIdByRobot.sentry, null);
  await writeFile(source, glb());
  assert.equal((await createStore().list()).modelIdByRobot.sentry, initial.id);
  await rm(source);
  await symlink(path.join(defaultDirectory, 'Drone.GLB'), source);
  assert.equal(await store.resolveModel(initial.id), null);
  assert.equal((await store.list()).models.length, 1);
});

test('empty or missing folders remain usable and cannot silently erase their saved assignments', async (t) => {
  const { store, customDirectory, createStore } = await fixture(t);
  const empty = await store.setDirectory(customDirectory);
  assert.equal(empty.models.length, 0);
  assert.equal(empty.directoryMissing, false);
  await writeFile(path.join(customDirectory, 'Robot.glb'), glb());
  const model = (await store.list()).models[0];
  await store.setForRobot('engineer', model.id);
  await rm(customDirectory, { recursive: true });
  const missing = await createStore().list();
  assert.equal(missing.directory, customDirectory);
  assert.equal(missing.directoryMissing, true);
  assert.equal(missing.modelIdByRobot.engineer, null);
  assert.equal(await store.getDirectory(), customDirectory);
  await mkdir(customDirectory);
  await writeFile(path.join(customDirectory, 'Robot.glb'), glb());
  assert.equal((await store.list()).modelIdByRobot.engineer, model.id);
  await assert.rejects(store.setDirectory(path.join(customDirectory, 'missing')));
  await assert.rejects(store.setDirectory(path.join(customDirectory, 'Robot.glb')), /existing model folder/);
  await assert.rejects(store.setDirectory('./relative'), /existing model folder/);
  assert.equal((await createStore().list()).directory, customDirectory);
});

test('old copied libraries reconnect by source filename and preserve scale, rotation and assignments', async (t) => {
  const { store, defaultDirectory, settingsPath, createStore } = await fixture(t);
  const sourceFileName = 'Legacy.glb';
  await writeFile(path.join(defaultDirectory, sourceFileName), glb());
  await mkdir(path.dirname(settingsPath));
  const id = '1b25cddd-7133-4cd7-8c7d-c5f0e4d28f70';
  const orientation = { scale: 0.001, rotationDeg: { x: 90 }, flipped: { z: true } };
  await writeFile(settingsPath, JSON.stringify({
    version: 2, modelIdByRobot: { infantry: id, drone: null, future: id },
    models: [{ id, name: 'Legacy', sourceFileName, sizeBytes: 100, importedAt: '2026-11-01', orientation }],
  }));
  const library = await store.list();
  const model = library.models[0];
  assert.equal(library.modelIdByRobot.infantry, model.id);
  assert.equal(library.modelIdByRobot.drone, null);
  assert.equal(library.modelIdByRobot.future, model.id);
  assert.equal(model.orientation.scale, 0.001);
  assert.equal(model.orientation.rotationDeg.x, 90);
  assert.equal(model.orientation.flipped.z, true);
  await store.setForRobot('hero', model.id);
  assert.equal(JSON.parse(await readFile(settingsPath, 'utf8')).version, 3);
  assert.equal((await createStore().list()).modelIdByRobot.infantry, model.id);
});

test('corrupt or unsupported saved settings are never overwritten by folder changes', async (t) => {
  const { store, settingsPath, customDirectory } = await fixture(t);
  await mkdir(path.dirname(settingsPath));
  for (const value of [
    'invalid JSON', JSON.stringify({ version: 4 }),
    JSON.stringify({ version: 3, directory: './relative', folders: {} }),
    JSON.stringify({ version: 3, directory: null, folders: { invalid: {} } }),
    JSON.stringify({ version: 3, directory: null, folders: { invalid: { modelFileByRobot: { hero: 7 }, orientationByFile: {} } } }),
  ]) {
    await writeFile(settingsPath, value);
    await assert.rejects(store.list(), /Unable to read robot model settings/);
    await assert.rejects(store.setDirectory(customDirectory), /Unable to read robot model settings/);
    assert.equal(await readFile(settingsPath, 'utf8'), value);
  }
});
