import type { TegakiBundle } from '../types.ts';

const fontFaceCache = new Map<string, Promise<void>>();

/**
 * Ensures the bundle's font face is loaded and available for rendering.
 * Resolves immediately if the font is already loaded.
 */
export async function ensureFontFace(bundle: TegakiBundle): Promise<void> {
  await ensureFont(bundle.family, bundle.fontUrl, bundle.features);
}

export function ensureFont(family: string, url: string, features?: string[]): Promise<void> | null {
  if (typeof document === 'undefined') return Promise.resolve();
  for (const face of document.fonts) {
    if (face.family === family) {
      if (face.status === 'loaded') return null;
      if (face.status === 'loading') return face.loaded.then(() => {});
    }
  }
  let cached = fontFaceCache.get(url);
  if (!cached) {
    // Align DOM shaping with the bundle. For bundles that declare features,
    // enable exactly those so DOM-measured layout matches what harfbuzz
    // produced for canvas glyphs (critical for scripts like Arabic where
    // calt picks different positional variants). Legacy bundles without
    // variant glyphs disable liga/calt so 1:1 char-to-glyph fallback holds.
    const featureSettings = features && features.length > 0 ? features.map((f) => `'${f}' 1`).join(', ') : "'calt' 0, 'liga' 0";
    cached = new FontFace(family, `url(${url})`, { featureSettings }).load().then((loaded) => {
      document.fonts.add(loaded);
    });
    fontFaceCache.set(url, cached);
  }
  return cached;
}
