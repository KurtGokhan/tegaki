import type { LineCap, TegakiBundle, TegakiGlyphData } from '../types.ts';

/**
 * Creates a {@link TegakiBundle} from its constituent parts.
 *
 * Useful when loading font data from a CDN or other source where the
 * pre-built bundle modules aren't available:
 *
 * ```js
 * const glyphData = await fetch('.../glyphData.json').then(r => r.json());
 * const bundle = createBundle({
 *   family: 'Caveat',
 *   fontUrl: '.../caveat.ttf',
 *   glyphData,
 * });
 * ```
 */
export function createBundle({
  family,
  fontUrl,
  glyphData,
  lineCap = 'round',
  unitsPerEm = 1000,
  ascender = 800,
  descender = -200,
}: {
  family: string;
  fontUrl: string;
  glyphData: Record<string, TegakiGlyphData>;
  lineCap?: LineCap;
  unitsPerEm?: number;
  ascender?: number;
  descender?: number;
}): TegakiBundle {
  return {
    family,
    lineCap,
    fontUrl,
    fontFaceCSS: `@font-face { font-family: '${family}'; src: url(${fontUrl}); }`,
    unitsPerEm,
    ascender,
    descender,
    glyphData,
  };
}
