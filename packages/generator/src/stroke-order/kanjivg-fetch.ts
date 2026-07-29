// KanjiVG SVG loader for the Bun CLI: fetches per-character files from the
// pinned KanjiVG release on GitHub and caches them on disk, mirroring the
// font download cache (.cache/fonts) layout. Node-only — the website supplies
// its own loader (served chunks) to createKanjiVGProvider instead.

import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { kanjiVGFilename } from './kanjivg.ts';

/** Pinned KanjiVG release tag so generated bundles are reproducible. */
export const KANJIVG_RELEASE = 'r20250816';

export const KANJIVG_CACHE_DIR = '.cache/kanjivg';

export interface KanjiVGLoaderOptions {
  cacheDir?: string;
  /** Re-download even when a cached file (or miss marker) exists. */
  force?: boolean;
  /** Release tag override (defaults to the pinned KANJIVG_RELEASE). */
  release?: string;
}

/**
 * Create a disk-cached SVG loader for createKanjiVGProvider. Returns null for
 * characters KanjiVG does not cover (404), caching the miss in a `.miss`
 * marker file so charset sweeps don't re-hit the network every run.
 */
export function createKanjiVGFileLoader(options: KanjiVGLoaderOptions = {}): (char: string) => Promise<string | null> {
  const cacheDir = resolve(options.cacheDir ?? KANJIVG_CACHE_DIR);
  const release = options.release ?? KANJIVG_RELEASE;

  return async (char: string): Promise<string | null> => {
    const filename = kanjiVGFilename(char);
    const svgPath = join(cacheDir, `${release}-${filename}`);
    const missPath = `${svgPath}.miss`;

    if (!options.force) {
      if (existsSync(svgPath)) return Bun.file(svgPath).text();
      if (existsSync(missPath)) return null;
    }

    const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/${release}/kanji/${filename}`;
    const response = await fetch(url);
    mkdirSync(cacheDir, { recursive: true });
    if (response.status === 404) {
      await Bun.write(missPath, '');
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to download KanjiVG file for "${char}" (${url}): ${response.status} ${response.statusText}`);
    }
    const svg = await response.text();
    await Bun.write(svgPath, svg);
    return svg;
  };
}
