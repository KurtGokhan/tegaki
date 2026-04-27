import type { HbShaper } from './hb-shaper.ts';

export interface VariantGlyph {
  /** OpenType glyph id of the variant. */
  gid: number;
  /** First cluster char observed producing this variant — used for RTL detection. */
  clusterChar: string;
}

/**
 * Discover every non-default glyph id reachable by shaping n-grams of the
 * input character set. A glyph id counts as non-default when it differs from
 * the nominal glyph id the font uses for the first character of its cluster.
 *
 * For now we shape every bigram and trigram. That's enough to surface the
 * standard Latin ligatures (`ff`, `fi`, `fl`, `ffi`, `ffl`, `st`, …) plus
 * pairwise contextual alternates; longer sequences are rare in handwriting
 * fonts and can be added with an opt-in knob later.
 *
 * The first cluster char observed producing each variant is returned so
 * downstream code can infer script direction (RTL for Arabic/Hebrew clusters)
 * when processing variants that lack their own unicode mapping.
 */
export function enumerateVariantGlyphIds(shaper: HbShaper, chars: readonly string[]): Map<number, VariantGlyph> {
  const variants = new Map<number, VariantGlyph>();

  const collectFrom = (seq: string) => {
    const shaped = shaper.shape(seq);
    for (const g of shaped) {
      const clusterChar = seq[g.cl];
      if (clusterChar == null) continue;
      const nominal = shaper.charToGlyphId(clusterChar);
      if (g.g === nominal || g.g === 0) continue;
      if (!variants.has(g.g)) variants.set(g.g, { gid: g.g, clusterChar });
    }
  };

  // Bigrams
  for (const a of chars) for (const b of chars) collectFrom(a + b);

  // Trigrams — the last N-gram size we sweep exhaustively. Most real-world
  // ligatures fit within 3 codepoints; rare 4+ ligatures would require a
  // smarter BFS walk that prunes based on intermediate shaping output.
  for (const a of chars) for (const b of chars) for (const c of chars) collectFrom(a + b + c);

  return variants;
}
