// Stroke matching: assign extracted geometry strokes to registered reference
// strokes 1:1 so the dataset's order and pen direction can be applied to the
// font's own geometry.
//
// The cost between two strokes is the mean pointwise distance after both are
// resampled to the same number of arc-length-uniform samples — index-aligned,
// no DTW. Strokes are short, monotone curves; after uniform resampling the
// correspondence IS the index, and the metric stays cheap and deterministic.
// Each pair is scored forward and reversed, so the assignment simultaneously
// decides which reference stroke an extracted stroke is and which way the pen
// travels along it. The global assignment is solved exactly (Hungarian).

import type { Point } from 'tegaki';

/** Samples per stroke for cost evaluation. */
const RESAMPLE_N = 24;

/** Padding cost for rectangular (count-mismatched) assignments — far above any real pair. */
const PAD_COST = 1e6;

export interface StrokeMatchPair {
  /** Index into the extracted strokes. */
  extracted: number;
  /** Index into the reference strokes. */
  reference: number;
  /** Normalized cost (fraction of the normalization length, typically glyph diagonal). */
  cost: number;
  /** True when the extracted stroke matches the reference best when reversed. */
  reversed: boolean;
}

export interface StrokeMatchResult {
  /** Matched pairs, one per min(extracted, reference) strokes. */
  pairs: StrokeMatchPair[];
  /** Mean cost over matched pairs (0 when nothing matched). */
  meanCost: number;
  extractedCount: number;
  referenceCount: number;
}

/** Resample a polyline to `n` arc-length-uniform points (endpoints included). */
export function resamplePolyline(points: Point[], n: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: n }, () => ({ ...points[0]! }));
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  }
  const total = cum[cum.length - 1]!;
  if (total <= 0) return Array.from({ length: n }, () => ({ ...points[0]! }));
  const out: Point[] = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (seg < points.length - 1 && cum[seg]! < target) seg++;
    const a = points[seg - 1]!;
    const b = points[seg]!;
    const span = cum[seg]! - cum[seg - 1]!;
    const t = span > 0 ? (target - cum[seg - 1]!) / span : 0;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Mean index-aligned distance between two equal-length sample arrays. */
function sampleDistance(a: Point[], b: Point[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y);
  return sum / a.length;
}

/**
 * Exact minimum-cost assignment for a square cost matrix (Kuhn-Munkres with
 * potentials, O(n³)). Returns the assigned column for each row.
 */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const colToRow = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    colToRow[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = colToRow[j0]!;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[colToRow[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }
      j0 = j1;
    } while (colToRow[j0] !== 0);
    do {
      const j1 = way[j0]!;
      colToRow[j0] = colToRow[j1]!;
      j0 = j1;
    } while (j0);
  }
  const rowToCol = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (colToRow[j]! > 0) rowToCol[colToRow[j]! - 1] = j - 1;
  }
  return rowToCol;
}

/**
 * Match extracted strokes to reference strokes (both in the same coordinate
 * space — register the reference first). `normalize` scales costs into a
 * resolution-independent fraction, typically the glyph bbox diagonal.
 */
export function matchStrokes(extracted: Point[][], reference: Point[][], normalize: number): StrokeMatchResult {
  const n = extracted.length;
  const m = reference.length;
  if (n === 0 || m === 0 || normalize <= 0) {
    return { pairs: [], meanCost: 0, extractedCount: n, referenceCount: m };
  }

  const extSamples = extracted.map((pts) => resamplePolyline(pts, RESAMPLE_N));
  const refSamples = reference.map((pts) => resamplePolyline(pts, RESAMPLE_N));
  const refSamplesRev = refSamples.map((s) => [...s].reverse());

  const size = Math.max(n, m);
  const cost: number[][] = [];
  const reversedFlags: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    const row = new Array<number>(size).fill(PAD_COST);
    const revRow = new Array<boolean>(size).fill(false);
    if (i < n) {
      for (let j = 0; j < m; j++) {
        const forward = sampleDistance(extSamples[i]!, refSamples[j]!) / normalize;
        const backward = sampleDistance(extSamples[i]!, refSamplesRev[j]!) / normalize;
        row[j] = Math.min(forward, backward);
        revRow[j] = backward < forward;
      }
    }
    cost.push(row);
    reversedFlags.push(revRow);
  }

  const assignment = hungarian(cost);
  const pairs: StrokeMatchPair[] = [];
  for (let i = 0; i < n; i++) {
    const j = assignment[i]!;
    if (j < 0 || j >= m) continue;
    pairs.push({ extracted: i, reference: j, cost: cost[i]![j]!, reversed: reversedFlags[i]![j]! });
  }
  const meanCost = pairs.length > 0 ? pairs.reduce((s, p) => s + p.cost, 0) / pairs.length : 0;
  return { pairs, meanCost, extractedCount: n, referenceCount: m };
}
