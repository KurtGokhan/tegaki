// KanjiVG stroke-order provider (Japanese kanji + kana).
//
// KanjiVG (https://kanjivg.tagaini.net) is copyright © Ulrich Apel, released
// under Creative Commons Attribution-Share Alike 3.0. Each character file is
// an SVG whose <path> elements are the strokes themselves — centerlines drawn
// in prescribed order, path direction = pen direction — inside a 109×109
// y-down viewBox. A separate StrokeNumbers group holds only <text> labels.
//
// Parsing is string-based (no DOM) so it runs in both the Bun CLI and the
// website's in-browser pipeline; IO is injected via a loader function.

import { flattenPath } from '../processing/bezier.ts';
import { parseSvgPathData } from './svg-path.ts';
import type { ReferenceGlyph, ReferenceStroke, StrokeOrderProvider } from './types.ts';

export const KANJIVG_LICENSE = 'KanjiVG © Ulrich Apel, CC BY-SA 3.0 (https://kanjivg.tagaini.net)';

/** KanjiVG file basename for a character: 5-hex-digit lowercase codepoint. */
export function kanjiVGFilename(char: string): string {
  const cp = char.codePointAt(0);
  if (cp === undefined) throw new Error('Empty character');
  return `${cp.toString(16).padStart(5, '0')}.svg`;
}

/**
 * Flattening tolerance in KanjiVG viewBox units (frame is 109×109, so 0.25 is
 * ~0.2% of the frame — fine enough that matching costs measure the stroke, not
 * the flattening).
 */
const KANJIVG_FLATTEN_TOLERANCE = 0.25;

const VIEWBOX_RE = /viewBox="([\d.\s+-]+)"/;
const PATH_RE = /<path\b[^>]*?\/?>/g;
const ATTR_D_RE = /\bd="([^"]+)"/;
const ATTR_ID_RE = /\bid="([^"]+)"/;
const ATTR_TYPE_RE = /\bkvg:type="([^"]+)"/;

/**
 * Parse a KanjiVG SVG document into a ReferenceGlyph. Returns null when the
 * document contains no stroke paths (not a KanjiVG file).
 */
export function parseKanjiVGSvg(svg: string, char: string): ReferenceGlyph | null {
  const vbMatch = VIEWBOX_RE.exec(svg);
  const [, , vw, vh] = vbMatch ? vbMatch[1]!.trim().split(/\s+/).map(Number) : [0, 0, 109, 109];

  // Strokes live in the StrokePaths group; the StrokeNumbers group holds only
  // <text>, but cut the document there anyway so a malformed file can't leak
  // stray paths into the stroke list.
  const numbersStart = svg.indexOf('<g id="kvg:StrokeNumbers');
  const strokeRegion = numbersStart >= 0 ? svg.slice(0, numbersStart) : svg;

  const strokes: { order: number; stroke: ReferenceStroke }[] = [];
  let docOrder = 0;
  for (const tag of strokeRegion.match(PATH_RE) ?? []) {
    const d = ATTR_D_RE.exec(tag)?.[1];
    if (!d) continue;
    docOrder++;
    // Path ids end in -sN with N the 1-based stroke number; trust it over
    // document order when present (it always is in released files).
    const id = ATTR_ID_RE.exec(tag)?.[1];
    const orderMatch = id ? /-s(\d+)$/.exec(id) : null;
    const order = orderMatch ? Number(orderMatch[1]) : docOrder;
    const type = ATTR_TYPE_RE.exec(tag)?.[1];

    // A stroke is a single open subpath; concatenating keeps pen order even if
    // a file ever contained more than one.
    const points = flattenPath(parseSvgPathData(d), KANJIVG_FLATTEN_TOLERANCE).flat();
    if (points.length < 2) continue;
    strokes.push({ order, stroke: type !== undefined ? { points, type } : { points } });
  }
  if (strokes.length === 0) return null;

  strokes.sort((a, b) => a.order - b.order);
  return {
    char,
    strokes: strokes.map((s) => s.stroke),
    viewBox: { width: vw || 109, height: vh || 109 },
    source: 'kanjivg',
    license: KANJIVG_LICENSE,
  };
}

/**
 * Build a StrokeOrderProvider from a KanjiVG SVG loader. The loader owns all
 * IO (file cache, network fetch, bundled chunks) and returns the raw SVG text
 * for a character, or null when the dataset has no entry. Parsed results are
 * memoized per character.
 */
export function createKanjiVGProvider(loadSvg: (char: string) => Promise<string | null>): StrokeOrderProvider {
  const cache = new Map<string, Promise<ReferenceGlyph | null>>();
  return {
    name: 'kanjivg',
    get(char: string): Promise<ReferenceGlyph | null> {
      let entry = cache.get(char);
      if (!entry) {
        entry = loadSvg(char).then((svg) => (svg === null ? null : parseKanjiVGSvg(svg, char)));
        cache.set(char, entry);
      }
      return entry;
    },
  };
}
