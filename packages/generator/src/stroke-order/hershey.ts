// Hershey stroke-order providers (Latin letters and digits).
//
// KanjiVG's Latin references are print-style — M as four strokes, m as
// three — which cursive fonts like Caveat genuinely contradict (their m is
// one continuous trajectory). The Hershey fonts are digitized PEN
// trajectories per letter, so they supply style variants the pipeline can
// choose between: `hershey-script` (Script simplex, formal cursive) and
// `hershey-simplex` (Simplex/futural, plain print — also the only reliable
// digit reference; the Script digits are double-stroked ornamentals and are
// excluded). Every variant is evaluated against the extracted ink and the
// best re-match wins, so print fonts pick print references and cursive
// fonts pick cursive ones.
//
// Like every provider, these are consultation-only: reference polylines
// inform order/direction/grouping decisions and never enter generated
// bundles.

import { HERSHEY_SCRIPT_GLYPHS } from './hershey-data.ts';
import { HERSHEY_SIMPLEX_GLYPHS } from './hershey-simplex-data.ts';
import type { ReferenceGlyph, StrokeOrderProvider } from './types.ts';

export const HERSHEY_LICENSE =
  'Hershey fonts by Dr. A. V. Hershey, U.S. National Bureau of Standards — free use with attribution; the data may not be sold as a font product';

/**
 * The Hershey frame: coordinates are (code - 'R') pairs, y-down, centered
 * near the origin; letters span roughly -16..21. Only the frame SIZE matters
 * downstream (registration uses it for thin-span detection), not the origin.
 */
const HERSHEY_VIEWBOX = { width: 32, height: 32 };

function createProvider(name: string, glyphs: Record<string, [number, number][][]>): StrokeOrderProvider {
  const cache = new Map<string, ReferenceGlyph | null>();
  return {
    name,
    async get(char: string): Promise<ReferenceGlyph | null> {
      let entry = cache.get(char);
      if (entry === undefined) {
        const strokes = glyphs[char];
        entry = strokes
          ? {
              char,
              strokes: strokes.map((s) => ({ points: s.map(([x, y]) => ({ x, y })) })),
              viewBox: HERSHEY_VIEWBOX,
              source: name,
              license: HERSHEY_LICENSE,
            }
          : null;
        cache.set(char, entry);
      }
      return entry;
    },
  };
}

/** Cursive Latin stroke-order references from the Hershey Script simplex font. */
export function createHersheyProvider(): StrokeOrderProvider {
  return createProvider('hershey-script', HERSHEY_SCRIPT_GLYPHS);
}

/** Print Latin + digit stroke-order references from the Hershey Simplex (futural) font. */
export function createHersheySimplexProvider(): StrokeOrderProvider {
  return createProvider('hershey-simplex', HERSHEY_SIMPLEX_GLYPHS);
}
