import type { CSSLength, TegakiBundle } from '../types.ts';

const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Resolve a CSSLength to pixels. Plain numbers are px, `"Nem"` is N * fontSize. */
export function resolveCSSLength(value: CSSLength, fontSize: number): number {
  if (typeof value === 'number') return value;
  return parseFloat(value) * fontSize;
}

export function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  // Fallback for environments without Intl.Segmenter (Safari < 16.4). Splits by
  // code point so surrogate pairs stay intact; combining marks and ZWJ emoji
  // clusters degrade to one entry per code point, which is acceptable because
  // glyph data is keyed per code point anyway.
  return Array.from(text);
}

/**
 * Build the CSS `font-family` value for a bundle, including the full
 * (non-subsetted) family as fallback when the bundle was generated from a subset.
 */
export function cssFontFamily(bundle: TegakiBundle): string {
  if (bundle.fullFamily) return `'${bundle.family}', '${bundle.fullFamily}'`;
  return `'${bundle.family}'`;
}

export type Coercible = string | number | boolean | null | undefined | readonly Coercible[];

export function coerceToString(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) return value.map(coerceToString).join('');
  return '';
}
