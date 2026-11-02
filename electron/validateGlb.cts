import { open, stat } from 'node:fs/promises';

export async function validateGlb(filePath: string): Promise<number> {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || fileStats.size < 20) throw new Error('The selected file is not a valid GLB model.');

  const file = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    if ((await file.read(header, 0, header.length, 0)).bytesRead !== header.length) throw new Error('Incomplete GLB header.');
    const declaredLength = header.readUInt32LE(8);
    if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2 || declaredLength !== fileStats.size) {
      throw new Error('KnightSim supports glTF 2.0 binary (.glb) models only.');
    }

    const chunkHeader = Buffer.alloc(8);
    if ((await file.read(chunkHeader, 0, chunkHeader.length, 12)).bytesRead !== chunkHeader.length) throw new Error('Incomplete GLB chunk.');
    const jsonLength = chunkHeader.readUInt32LE(0);
    const jsonChunkType = chunkHeader.readUInt32LE(4);
    if (jsonChunkType !== 0x4e4f534a || jsonLength === 0 || jsonLength % 4 !== 0 || jsonLength > 32 * 1024 * 1024 || jsonLength > fileStats.size - 20) {
      throw new Error('The selected file has an invalid glTF data section.');
    }
    const jsonBuffer = Buffer.alloc(jsonLength);
    if ((await file.read(jsonBuffer, 0, jsonLength, 20)).bytesRead !== jsonLength) throw new Error('Incomplete GLB data section.');
    try {
      JSON.parse(jsonBuffer.toString('utf8').replace(/\0+$/u, '').trim());
    } catch {
      throw new Error('The selected file has an invalid glTF data section.');
    }
  } finally {
    await file.close();
  }

  return fileStats.size;
}

