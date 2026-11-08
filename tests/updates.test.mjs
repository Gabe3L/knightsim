import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';

const { UpdateManager } = await loadTypeScript(new URL('../electron/updateManager.cts', import.meta.url));
const { loadPublishedAt, publishedAtForVersion } = await loadTypeScript(new URL('../electron/releaseMetadata.cts', import.meta.url));

class FakeUpdater extends EventEmitter {
  checks = 0;
  downloads = 0;
  installs = [];
  async checkForUpdates() {
    this.checks++;
    this.emit('update-available', { version: '0.2.0' });
    return { updateInfo: { version: '0.2.0' } };
  }
  async downloadUpdate() {
    this.downloads++;
    this.emit('download-progress', { percent: 45.5 });
    this.emit('update-downloaded', { version: '0.2.0' });
    return ['/verified-installer'];
  }
  quitAndInstall(...args) { this.installs.push(args); }
}

function setup(disabledReason = null) {
  const driver = new FakeUpdater();
  const changes = [];
  const scheduled = [];
  const manager = new UpdateManager(driver, '0.1.0', disabledReason, (state) => changes.push(state), (fn) => scheduled.push(fn));
  return { driver, manager, changes, scheduled };
}

test('checking never downloads; a user action downloads, verifies, and schedules a relaunch', async () => {
  const { driver, manager, changes, scheduled } = setup();
  assert.equal(driver.autoDownload, false);
  assert.equal(driver.autoInstallOnAppQuit, false);
  assert.equal(driver.allowPrerelease, false);
  await manager.install();
  assert.equal(driver.downloads, 0);
  await manager.check();
  assert.equal(manager.getState().status, 'available');
  assert.equal(driver.downloads, 0);
  await manager.install();
  assert.equal(driver.downloads, 1);
  assert.deepEqual(changes.filter((s) => s.status === 'downloading').map((s) => s.downloadPercent), [0, 46]);
  assert.equal(manager.getState().status, 'installing');
  assert.equal(driver.installs.length, 0);
  scheduled[0]();
  assert.deepEqual(driver.installs, [[true, true]]);
  assert.ok(changes.every((s, i) => i === 0 || s.revision > changes[i - 1].revision));
});

test('duplicate clicks and checks during downloads cannot start overlapping operations', async () => {
  const { driver, manager } = setup();
  let complete;
  driver.downloadUpdate = () => {
    driver.downloads++;
    return new Promise((resolve) => { complete = resolve; });
  };
  await manager.check();
  const installing = manager.install();
  await Promise.all([manager.install(), manager.install(), manager.check()]);
  assert.equal(driver.downloads, 1);
  assert.equal(driver.checks, 1);
  driver.emit('update-downloaded', { version: '0.2.0' });
  complete([]);
  await installing;
  await manager.install();
  assert.equal(driver.downloads, 1);
});

test('a download without the verified completion event cannot restart the app', async () => {
  const { driver, manager, scheduled } = setup();
  driver.downloadUpdate = async () => [];
  await manager.check();
  await manager.install();
  assert.equal(manager.getState().status, 'error');
  assert.equal(scheduled.length, 0);
});

test('offline checks, failed downloads, and failed installs can be retried', async () => {
  const { driver, manager, scheduled } = setup();
  driver.checkForUpdates = async () => { throw new Error('offline'); };
  await manager.check();
  assert.equal(manager.getState().status, 'error');
  driver.checkForUpdates = FakeUpdater.prototype.checkForUpdates;
  await manager.check();
  driver.downloadUpdate = async () => { throw new Error('interrupted'); };
  await manager.install();
  assert.equal(manager.getState().status, 'error');
  assert.equal(scheduled.length, 0);
  driver.downloadUpdate = FakeUpdater.prototype.downloadUpdate;
  await manager.install();
  driver.quitAndInstall = () => { throw new Error('installer failed'); };
  scheduled.shift()();
  assert.equal(manager.getState().status, 'error');
  driver.quitAndInstall = FakeUpdater.prototype.quitAndInstall;
  await manager.install();
  scheduled.shift()();
  assert.equal(driver.downloads, 1, 'retrying installation uses the verified download');
  assert.equal(driver.installs.length, 1);
});

test('up-to-date checks keep the current version timestamp independent of the latest release', async () => {
  const { driver, manager } = setup();
  manager.setPublishedAt('2026-11-08T12:00:00.000Z');
  driver.checkForUpdates = async () => {
    driver.emit('update-not-available', { version: '0.1.0', releaseDate: '2099-01-01' });
    return {};
  };
  await manager.check();
  assert.equal(manager.getState().status, 'up-to-date');
  assert.equal(manager.getState().publishedAt, '2026-11-08T12:00:00.000Z');
  assert.equal(manager.getState().currentVersion, '0.1.0');
});

test('development builds never check, download, or install', async () => {
  const { driver, manager, scheduled } = setup('Development build');
  await manager.check();
  await manager.install();
  assert.equal(manager.getState().status, 'disabled');
  assert.equal(driver.checks, 0);
  assert.equal(driver.downloads, 0);
  assert.equal(scheduled.length, 0);
});

test('publish dates must belong to the exact installed version and a published release', () => {
  const release = { draft: false, tag_name: 'v0.1.0', published_at: '2026-11-08T13:04:05Z' };
  assert.equal(publishedAtForVersion(release, '0.1.0'), '2026-11-08T13:04:05.000Z');
  for (const value of [null, {}, { ...release, draft: true }, { ...release, tag_name: 'v0.2.0' }, { ...release, published_at: 'invalid' }]) {
    assert.equal(publishedAtForVersion(value, '0.1.0'), null);
  }
});

test('published date is cached for offline use and invalidated after an update', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knightsim-release-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cachePath = path.join(directory, 'release-metadata.json');
  let requests = 0;
  const online = async (url) => {
    requests++;
    assert.match(url, /\/releases\/tags\/v0\.1\.0$/);
    return { ok: true, json: async () => ({ draft: false, tag_name: 'v0.1.0', published_at: '2026-11-08T13:04:05Z' }) };
  };
  const publishedAt = await loadPublishedAt('0.1.0', cachePath, online);
  assert.equal(publishedAt, '2026-11-08T13:04:05.000Z');
  assert.equal(await loadPublishedAt('0.1.0', cachePath, online), publishedAt);
  assert.equal(requests, 1);
  assert.equal(JSON.parse(await readFile(cachePath, 'utf8')).tag_name, 'v0.1.0');
  const offline = async () => { throw new Error('offline'); };
  assert.equal(await loadPublishedAt('0.1.0', cachePath, offline), publishedAt);
  assert.equal(await loadPublishedAt('0.2.0', cachePath, offline), null);
  await writeFile(cachePath, 'bad json');
  assert.equal(await loadPublishedAt('0.1.0', cachePath, online), publishedAt);
  assert.equal(requests, 2);
});

test('missing or inaccessible releases never invent a publication timestamp', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knightsim-release-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cachePath = path.join(directory, 'release-metadata.json');
  assert.equal(await loadPublishedAt('0.1.0', cachePath, async () => ({ ok: false })), null);
  assert.equal(await loadPublishedAt('0.1.0', cachePath, async () => ({ ok: true, json: async () => ({}) })), null);
});
