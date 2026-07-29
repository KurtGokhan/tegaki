// Multi-provider reference collection: one character can have reference
// VARIANTS from different datasets (KanjiVG's print-style Latin, Hershey's
// cursive). The geometry pipeline evaluates each variant against the
// extracted ink and adopts whichever matches best, so handwriting styles
// coexist without any per-font configuration.

import type { ReferenceGlyph, StrokeOrderProvider } from './types.ts';

/**
 * Gather reference variants for a character, provider order preserved,
 * misses and failures skipped.
 */
export async function collectReferences(char: string, providers: StrokeOrderProvider[]): Promise<ReferenceGlyph[]> {
  const refs = await Promise.all(providers.map((p) => p.get(char).catch(() => null)));
  return refs.filter((r): r is ReferenceGlyph => r !== null);
}
