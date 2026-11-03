import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

/** Only regular GLB files directly inside the selected directory. */
export async function listModelSources(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  });
  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.glb')
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function resolveModelSource(directory: string, fileName: unknown): Promise<string> {
  const unavailable = (): Error => new Error('Choose an available .glb robot model from the selected folder.');
  if (typeof fileName !== 'string' || /[/\\\0]/u.test(fileName) || path.extname(fileName).toLowerCase() !== '.glb') {
    throw unavailable();
  }
  const sourcePath = path.join(directory, fileName);
  // Check again before opening: an entry may have changed since the directory scan.
  const fileStats = await lstat(sourcePath).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw unavailable();
    throw error;
  });
  if (!fileStats.isFile()) throw unavailable();
  return sourcePath;
}
