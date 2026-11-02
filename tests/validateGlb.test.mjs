import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadTypeScript } from './loadTypeScript.mjs';
const { validateGlb } = await loadTypeScript(new URL('../electron/validateGlb.cts', import.meta.url));

function glb(json = '{"asset":{"version":"2.0"}}') {
  const payload = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4));
  const buffer = Buffer.alloc(20 + payload.length);
  buffer.write('glTF'); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(payload.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); payload.copy(buffer, 20);
  return buffer;
}

test('GLB validator accepts binary glTF and rejects truncated or malformed chunks', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'knightsim-glb-'));
  const file = path.join(directory, 'robot.glb');
  try {
    const valid = glb();
    await writeFile(file, valid);
    assert.equal(await validateGlb(file), valid.length);
    const wrongLength = glb(); wrongLength.writeUInt32LE(12345, 8);
    const wrongChunk = glb(); wrongChunk.writeUInt32LE(0, 16);
    const hugeJson = glb(); hugeJson.writeUInt32LE(0xfffffffc, 12);
    for (const bytes of [Buffer.alloc(12), valid.subarray(0, 24), wrongLength, wrongChunk, hugeJson, glb('invalid JSON')]) {
      await writeFile(file, bytes);
      await assert.rejects(validateGlb(file));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
