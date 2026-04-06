import type { TegakiBundle } from '../types.ts';

const fontFaceCache = new Map<string, Promise<void>>();

/**
 * Ensures the bundle's font face is loaded and available for rendering.
 * Resolves immediately if the font is already loaded.
 */
export async function ensureFontFace(bundle: TegakiBundle): Promise<void> {
  await ensureFont(bundle.family, bundle.fontUrl);
}

export function ensureFont(family: string, url: string): Promise<void> | null {
  if (typeof document === 'undefined') return Promise.resolve();
  for (const face of document.fonts) {
    if (face.family === family) {
      if (face.status === 'loaded') return null;
      if (face.status === 'loading') return face.loaded.then(() => {});
    }
  }
  let cached = fontFaceCache.get(url);
  if (!cached) {
    cached = new FontFace(family, `url(${url})`, { featureSettings: "'calt' 0, 'liga' 0" }).load().then((loaded) => {
      document.fonts.add(loaded);
    });
    fontFaceCache.set(url, cached);
  }
  return cached;
}
