// Stage 5 of the pipeline — see commands/generate.ts.
// Group polylines into connected components, decide draw order (top-to-bottom,
// left-to-right) and per-stroke direction, then assign each point a normalized
// time `t` ∈ [0, 1] for animation. Stroke widths are looked up from the
// inverse distance transform (or pre-supplied by the voronoi path).

import type { Point, Stroke, TimedPoint } from 'tegaki';
import { ORIENT_X_WEIGHT } from '../constants.ts';
import { getStrokeWidth } from './width.ts';

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/**
 * Orient a polyline so the "natural" starting point comes first.
 *
 * For near-closed loops (start ≈ end), rotates the chain to start from the
 * leftmost (LTR) or rightmost (RTL) point — the natural pen entry for the
 * script's writing direction.
 *
 * For open polylines, reverses if the end has a better (lower) orientation
 * score than the start. The x-weight flips sign for RTL so "preferred" means
 * rightmost instead of leftmost.
 */
function orientPolyline(points: Point[], rtl = false): Point[] {
  if (points.length < 2) return points;

  const start = points[0]!;
  const end = points[points.length - 1]!;
  const xWeight = rtl ? -ORIENT_X_WEIGHT : ORIENT_X_WEIGHT;

  // Near-closed loop: rotate to start from the leftmost (LTR) / rightmost (RTL) point
  if (dist(start, end) < 5) {
    // 2-point fragments (e.g. dots traced from a 2-pixel skeleton blob) aren't
    // real loops — the rotation formula would duplicate the extremum endpoint
    // into `[B, B]`, yielding a zero-length "stroke" that the renderer's
    // multi-point path drops. Collapse to a single-point dot instead.
    if (points.length === 2) return [start];
    let bestIdx = 0;
    let bestX = points[0]!.x;
    let bestY = points[0]!.y;
    for (let i = 1; i < points.length; i++) {
      const p = points[i]!;
      const better = rtl ? p.x > bestX || (p.x === bestX && p.y < bestY) : p.x < bestX || (p.x === bestX && p.y < bestY);
      if (better) {
        bestX = p.x;
        bestY = p.y;
        bestIdx = i;
      }
    }
    if (bestIdx !== 0) {
      return [...points.slice(bestIdx), ...points.slice(1, bestIdx + 1)];
    }
    return points;
  }

  // Open polyline: prefer starting from the script's "entry" side (top as tiebreaker)
  const startScore = start.y + start.x * xWeight;
  const endScore = end.y + end.x * xWeight;

  if (endScore < startScore) {
    return [...points].reverse();
  }
  return points;
}

/**
 * Process polylines into strokes, preserving the order from traceAndSimplify
 * which already implements proximity-based ordering (entry-side start,
 * closest-to-last-end sequencing). The entry side is middle-left for LTR and
 * middle-right for RTL scripts; see `traceAndSimplify` for the source.
 *
 * Each polyline is oriented for natural handwriting direction, then assigned
 * t parameter (animation progress) and stroke width values.
 */
export function orderStrokes(
  polylines: Point[][],
  inverseDT: Float32Array | null,
  bitmapWidth: number,
  _connectionThreshold = 3,
  precomputedWidths?: number[][],
  rtl = false,
): Stroke[] {
  if (polylines.length === 0) return [];

  const strokes: Stroke[] = [];

  for (let order = 0; order < polylines.length; order++) {
    const polyline = polylines[order]!;
    const oriented = orientPolyline(polyline, rtl);
    const totalLen = pathLength(oriented);

    // Look up precomputed widths by matching the original polyline reference
    const origIdx = precomputedWidths ? polylines.indexOf(polyline) : -1;
    const pWidths = origIdx >= 0 ? precomputedWidths![origIdx] : null;

    // Assign t parameter and width
    let cumLen = 0;
    const points: TimedPoint[] = oriented.map((p, i) => {
      if (i > 0) {
        cumLen += dist(oriented[i - 1]!, p);
      }
      const t = totalLen > 0 ? cumLen / totalLen : 0;
      // Precomputed widths use original point order; check if oriented is reversed
      const isReversed = oriented !== polyline && oriented[0] !== polyline[0];
      const widthIdx = isReversed ? oriented.length - 1 - i : i;
      const width = pWidths ? (pWidths[widthIdx] ?? 1) : inverseDT ? getStrokeWidth(p.x, p.y, inverseDT, bitmapWidth) : 1;
      return { x: p.x, y: p.y, t, width };
    });

    strokes.push({ points, order, length: totalLen, animationDuration: 0, delay: 0 });
  }

  // Single-point strokes (dots) get their width from the distance transform which
  // represents the blob's inscribed radius, not the pen width. Replace with the
  // average width of other strokes so dots match the visual weight of the glyph.
  const multiPointStrokes = strokes.filter((s) => s.points.length > 1);
  if (multiPointStrokes.length > 0) {
    const avgWidth =
      multiPointStrokes.reduce((sum, s) => sum + s.points.reduce((ps, p) => ps + p.width, 0) / s.points.length, 0) /
      multiPointStrokes.length;
    for (const s of strokes) {
      if (s.points.length === 1) {
        s.points[0]!.width = Math.round(avgWidth * 100) / 100;
      }
    }
  }

  return strokes;
}
