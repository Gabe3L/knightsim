import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';

const { listModelSources, resolveModelSource } = await loadTypeScript(new URL('../electron/modelSources.cts', import.meta.url));

test('model folders list only regular GLB files directly inside the chosen directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'knightsim-model-sources-'));
  const models = path.join(root, 'models');
  try {
    assert.deepEqual(await listModelSources(models), []);
    await mkdir(models);
    await writeFile(path.join(models, 'Sentry.glb'), 'model');
    await writeFile(path.join(models, 'Drone.GLB'), 'model');
    await writeFile(path.join(models, 'notes.txt'), 'notes');
    await mkdir(path.join(models, 'nested.glb'));
    await writeFile(path.join(models, 'nested.glb', 'Hidden.glb'), 'model');
    const outside = path.join(root, 'Outside.glb');
    await writeFile(outside, 'model');
    await symlink(outside, path.join(models, 'Linked.glb'));

    assert.deepEqual(await listModelSources(models), ['Drone.GLB', 'Sentry.glb']);
    assert.equal(await resolveModelSource(models, 'Sentry.glb'), path.join(models, 'Sentry.glb'));
    for (const source of [null, {}, outside, '../Outside.glb', '..\\Outside.glb', 'notes.txt', 'nested.glb', 'nested.glb/Hidden.glb', 'Linked.glb']) {
      await assert.rejects(resolveModelSource(models, source), /from the selected folder/);
    }

    await rm(path.join(models, 'Sentry.glb'));
    await assert.rejects(resolveModelSource(models, 'Sentry.glb'), /from the selected folder/);
    await writeFile(path.join(models, 'Hero.glb'), 'model');
    assert.deepEqual(await listModelSources(models), ['Drone.GLB', 'Hero.glb']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
