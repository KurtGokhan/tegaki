// Hershey Script stroke-order provider (Latin letters, cursive style).
//
// KanjiVG's Latin references are print-style — M as four strokes, m as
// three — which cursive fonts like Caveat genuinely contradict (their m is
// one continuous trajectory). The Hershey Script simplex font is a digitized
// cursive PEN trajectory per letter, so it supplies the cursive-style
// reference variant; the pipeline evaluates every variant against the
// extracted ink and adopts whichever re-matches best, so print fonts keep
// KanjiVG and cursive fonts pick these.
//
// Like every provider, this is consultation-only: reference polylines inform
// order/direction/grouping decisions and never enter generated bundles.

import { HERSHEY_SCRIPT_GLYPHS } from './hershey-data.ts';
import type { ReferenceGlyph, StrokeOrderProvider } from './types.ts';

export const HERSHEY_LICENSE =
  'Hershey fonts by Dr. A. V. Hershey, U.S. National Bureau of Standards — free use with attribution; the data may not be sold as a font product';

/**
 * The Hershey frame: coordinates are (code - 'R') pairs, y-down, centered
 * near the origin; letters span roughly -16..21. Only the frame SIZE matters
 * downstream (registration uses it for thin-span detection), not the origin.
 */
const HERSHEY_VIEWBOX = { width: 32, height: 32 };

/** Cursive Latin stroke-order references from the Hershey Script simplex font. */
export function createHersheyProvider(): StrokeOrderProvider {
  const cache = new Map<string, ReferenceGlyph | null>();
  return {
    name: 'hershey-script',
    async get(char: string): Promise<ReferenceGlyph | null> {
      let entry = cache.get(char);
      if (entry === undefined) {
        const strokes = HERSHEY_SCRIPT_GLYPHS[char];
        entry = strokes
          ? {
              char,
              strokes: strokes.map((s) => ({ points: s.map(([x, y]) => ({ x, y })) })),
              viewBox: HERSHEY_VIEWBOX,
              source: 'hershey-script',
              license: HERSHEY_LICENSE,
            }
          : null;
        cache.set(char, entry);
      }
      return entry;
    },
  };
}
