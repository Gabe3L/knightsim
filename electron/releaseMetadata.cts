import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import releaseConfig from './releaseConfig.json';

export function publishedAtForVersion(value: unknown, version: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const release = value as Record<string, unknown>;
  if (release.draft !== false || release.tag_name !== `v${version}` || typeof release.published_at !== 'string') return null;
  const timestamp = Date.parse(release.published_at);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/** Fetch the running version's actual publication date, never the latest release or build time. */
export async function loadPublishedAt(
  version: string,
  cachePath: string,
  fetchRelease: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>,
): Promise<string | null> {
  try {
    const cached: unknown = JSON.parse(await readFile(cachePath, 'utf8'));
    const publishedAt = publishedAtForVersion(cached, version);
    if (publishedAt) return publishedAt;
  } catch { /* First launch, unreadable cache, or another installed version. */ }

  try {
    const { owner, repo } = releaseConfig;
    const response = await fetchRelease(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(`v${version}`)}`);
    if (!response.ok) return null;
    const release = await response.json();
    const publishedAt = publishedAtForVersion(release, version);
    if (!publishedAt) return null;
    try {
      await mkdir(path.dirname(cachePath), { recursive: true });
      const temporaryPath = `${cachePath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify({ tag_name: `v${version}`, draft: false, published_at: publishedAt }), 'utf8');
      await rename(temporaryPath, cachePath);
    } catch { /* A read-only cache must not hide a valid release date. */ }
    return publishedAt;
  } catch {
    return null;
  }
}
