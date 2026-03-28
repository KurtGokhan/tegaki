import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CACHE_DIR } from '../constants.ts';

function slugify(family: string): string {
  return family.toLowerCase().replace(/\s+/g, '-');
}

function extractTtfUrl(css: string): string | null {
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
  return match?.[1] ?? null;
}

export async function downloadFont(family: string, options: { cacheDir?: string; force?: boolean } = {}): Promise<string> {
  const cacheDir = resolve(options.cacheDir ?? CACHE_DIR);
  const slug = slugify(family);
  const fontPath = join(cacheDir, `${slug}.ttf`);

  if (!options.force && existsSync(fontPath)) {
    return fontPath;
  }

  mkdirSync(cacheDir, { recursive: true });

  const encodedFamily = encodeURIComponent(family);
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}`;

  const cssResponse = await fetch(cssUrl, {
    headers: {
      // A non-browser User-Agent triggers .ttf responses from Google Fonts
      'User-Agent': 'handy-text/1.0',
    },
  });

  if (!cssResponse.ok) {
    throw new Error(`Failed to fetch font CSS for "${family}": ${cssResponse.status} ${cssResponse.statusText}`);
  }

  const css = await cssResponse.text();
  const ttfUrl = extractTtfUrl(css);

  if (!ttfUrl) {
    throw new Error(`Could not find .ttf URL in Google Fonts CSS for "${family}". The CSS returned:\n${css.slice(0, 500)}`);
  }

  const fontResponse = await fetch(ttfUrl);
  if (!fontResponse.ok) {
    throw new Error(`Failed to download font file: ${fontResponse.status} ${fontResponse.statusText}`);
  }

  const buffer = await fontResponse.arrayBuffer();
  await Bun.write(fontPath, buffer);

  return fontPath;
}
