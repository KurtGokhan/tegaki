import { BUNDLE_VERSION, type LineCap, type TegakiBundle, type TegakiGlyphData } from '../types.ts';

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
  fullFamily,
  fontUrl,
  fullFontUrl,
  glyphData,
  lineCap = 'round',
  unitsPerEm = 1000,
  ascender = 800,
  descender = -200,
}: {
  family: string;
  fullFamily?: string;
  fontUrl: string;
  fullFontUrl?: string;
  glyphData: Record<string, TegakiGlyphData>;
  lineCap?: LineCap;
  unitsPerEm?: number;
  ascender?: number;
  descender?: number;
}): TegakiBundle {
  const rules = [`@font-face { font-family: '${family}'; src: url(${fontUrl}); }`];
  if (fullFamily && fullFontUrl) {
    rules.push(`@font-face { font-family: '${fullFamily}'; src: url(${fullFontUrl}); }`);
  }
  return {
    version: BUNDLE_VERSION,
    family,
    fullFamily,
    lineCap,
    fontUrl,
    fullFontUrl,
    fontFaceCSS: rules.join(' '),
    unitsPerEm,
    ascender,
    descender,
    glyphData,
  };
}
