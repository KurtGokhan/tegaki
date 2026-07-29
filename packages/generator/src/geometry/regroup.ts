// Dataset-guided stroke re-grouping.
//
// When the heuristic assembly's strokes disagree with a stroke-order
// reference (stroke counts differ, or the match cost is out of range), the
// reference can still guide a better GROUPING of the same ink. Two moves,
// both operating on the assembled stroke polylines:
//
// - SPLIT: an extracted stroke whose edges change allegiance between
//   reference strokes is cut at the allegiance seams. A box (口) is extracted
//   as one closed annulus loop — its corner turns merge through bare cuts, so
//   there is no junction anywhere to re-pair — but its edges label
//   left / top+right / bottom cleanly, and splitting at the seams yields
//   exactly the three prescribed strokes.
// - MERGE: extracted strokes lying along the SAME reference stroke are
//   chained end-to-end in reference arc-length order when their endpoints
//   meet. A cursive kana like れ legitimately bends far beyond the
//   continuation gate's 75°, so the heuristic splits what the dataset knows
//   is one stroke; strokes drawn as separate overlapping contours land in
//   different pipeline regions and could never merge before.
//
// Edge labels use nearest-reference distance plus a DIRECTION penalty: where
// a stroke crosses another, its points pass within half a width of the other
// reference, but the local travel direction is nowhere near the other
// reference's tangent — the penalty keeps the crossing from flickering the
// label. Residual flicker shorter than `minRunLength` merges into its
// neighbouring runs.
//
// Everything here is a PROPOSAL built from the font's own geometry — the
// caller re-matches the result against the reference and adopts it only when
// it verifies clean, so re-grouping is never worse than the heuristic
// baseline. Reference geometry itself never enters the output strokes
// (consultation-only license boundary, see stroke-order/types.ts).

import type { Point } from 'tegaki';
import { resamplePolyline } from '../stroke-order/match.ts';
import { dist } from './primitives.ts';
import type { AxisPoint, GeoStroke } from './types.ts';

export interface RegroupOptions {
  /** Densification spacing for edge labeling (≈ the pipeline's resample spacing). */
  spacing: number;
  /** Label runs shorter than this arc length are noise and merge into a neighbour. */
  minRunLength: number;
  /** Glyph bbox diagonal — scales the merge gap tolerance. */
  glyphDiag: number;
}

export interface RegroupResult {
  strokes: GeoStroke[];
  /** Extracted strokes that were split at label seams. */
  splits: number;
  /** End-to-end links applied between same-reference pieces. */
  merges: number;
}

interface RefIndex {
  pts: Point[];
  /** Cumulative arc length at each vertex. */
  cum: number[];
  total: number;
}

function indexRef(pts: Point[]): RefIndex | null {
  if (pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
  const total = cum[cum.length - 1]!;
  return total > 0 ? { pts, cum, total } : null;
}

interface Projection {
  /** Distance to the nearest point of the reference polyline. */
  d: number;
  /** Normalized arc-length position (0..1) of that nearest point. */
  t: number;
  /** Unit tangent of the reference at the nearest point. */
  tangent: Point;
}

function projectToRef(p: Point, ref: RefIndex): Projection {
  let best: Projection = { d: Infinity, t: 0, tangent: { x: 0, y: 0 } };
  for (let i = 1; i < ref.pts.length; i++) {
    const a = ref.pts[i - 1]!;
    const b = ref.pts[i]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const s = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
    const qx = a.x + abx * s;
    const qy = a.y + aby * s;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (d < best.d) {
      const len = Math.sqrt(len2);
      best = {
        d,
        t: (ref.cum[i - 1]! + len * s) / ref.total,
        tangent: len > 0 ? { x: abx / len, y: aby / len } : { x: 0, y: 0 },
      };
    }
  }
  return best;
}

/** Insert interpolated points so no edge exceeds `spacing` (labels need granularity). */
function densify(pts: AxisPoint[], spacing: number): AxisPoint[] {
  const out: AxisPoint[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = dist(a, b);
    const n = Math.ceil(len / spacing);
    for (let k = 1; k < n; k++) {
      const s = k / n;
      out.push({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, width: a.width + (b.width - a.width) * s });
    }
    out.push(b);
  }
  return out;
}

/** Contiguous run of equally-labeled edges. */
interface Run {
  label: number;
  /** First and last edge index (inclusive). */
  e0: number;
  e1: number;
  len: number;
}

function buildRuns(labels: number[], edgeLens: number[]): Run[] {
  const runs: Run[] = [];
  for (let e = 0; e < labels.length; e++) {
    const last = runs[runs.length - 1];
    if (last && last.label === labels[e]!) {
      last.e1 = e;
      last.len += edgeLens[e]!;
    } else {
      runs.push({ label: labels[e]!, e0: e, e1: e, len: edgeLens[e]! });
    }
  }
  return runs;
}

/**
 * Merge label runs shorter than `minRun` into their longer neighbour until
 * every remaining run is substantial. `circular` joins first/last as
 * neighbours (closed loops). Operates by relabeling + rebuilding, so merges
 * of newly-adjacent equal labels are picked up each round.
 */
function smoothRuns(labels: number[], edgeLens: number[], minRun: number, circular: boolean): Run[] {
  for (;;) {
    let runs = buildRuns(labels, edgeLens);
    if (circular && runs.length >= 2 && runs[0]!.label === runs[runs.length - 1]!.label) {
      // Wrapping run: fold the tail into the head for length accounting.
      runs[0]!.len += runs[runs.length - 1]!.len;
      runs[0]!.e0 = runs[runs.length - 1]!.e0; // marks the wrap; only len matters below
      runs = runs.slice(0, -1);
    }
    if (runs.length <= 1) return runs;
    let shortest = 0;
    for (let i = 1; i < runs.length; i++) if (runs[i]!.len < runs[shortest]!.len) shortest = i;
    if (runs[shortest]!.len >= minRun) return runs;
    const prev = shortest > 0 ? runs[shortest - 1] : circular ? runs[runs.length - 1] : undefined;
    const next = shortest < runs.length - 1 ? runs[shortest + 1] : circular ? runs[0] : undefined;
    const into = prev && next ? (prev.len >= next.len ? prev : next) : (prev ?? next);
    if (!into) return runs;
    const run = runs[shortest]!;
    // Relabel the short run's edges (e0..e1 may wrap when it is the folded head).
    for (let e = run.e0; ; e = (e + 1) % labels.length) {
      labels[e] = into.label;
      if (e === run.e1) break;
    }
  }
}

/**
 * Split one stroke at reference-label seams. Returns [stroke] (the original
 * object) when the whole stroke belongs to a single reference.
 */
function splitStroke(stroke: GeoStroke, refs: (RefIndex | null)[], options: RegroupOptions): GeoStroke[] {
  if (stroke.points.length < 2) return [stroke];
  const pts = densify(stroke.points, options.spacing);
  // Closed loops label circularly so a seam can fall anywhere on the ring.
  let closed = stroke.isLoop && dist(pts[0]!, pts[pts.length - 1]!) < options.spacing * 2;
  if (closed && dist(pts[0]!, pts[pts.length - 1]!) < 1e-6) pts.pop();
  if (pts.length < 3) closed = false;
  const n = pts.length;
  const edgeCount = closed ? n : n - 1;

  const labels: number[] = [];
  const edgeLens: number[] = [];
  for (let e = 0; e < edgeCount; e++) {
    const a = pts[e]!;
    const b = pts[(e + 1) % n]!;
    const len = dist(a, b);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dir = len > 0 ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 0, y: 0 };
    const w = (a.width + b.width) / 2;
    let bestLabel = -1;
    let bestCost = Infinity;
    for (let r = 0; r < refs.length; r++) {
      const ref = refs[r];
      if (!ref) continue;
      const proj = projectToRef(mid, ref);
      // Direction penalty: crossing another reference brings the distance
      // near zero, but the travel direction stays ~perpendicular to it.
      const cost = proj.d + (1 - Math.abs(dir.x * proj.tangent.x + dir.y * proj.tangent.y)) * w;
      if (cost < bestCost) {
        bestCost = cost;
        bestLabel = r;
      }
    }
    labels.push(bestLabel);
    edgeLens.push(len);
  }
  if (labels.length === 0 || labels.every((l) => l === labels[0])) return [stroke];

  const runs = smoothRuns(labels, edgeLens, options.minRunLength, closed);
  if (runs.length <= 1) return [stroke];

  // Rebuild runs from the smoothed labels with a stable start: for closed
  // loops rotate so edge 0 begins a run, then cut linearly.
  let start = 0;
  if (closed) {
    for (let e = 0; e < edgeCount; e++) {
      if (labels[e] !== labels[(e - 1 + edgeCount) % edgeCount]) {
        start = e;
        break;
      }
    }
  }
  const parts: GeoStroke[] = [];
  let partPts: AxisPoint[] = [];
  let partLabel = -2;
  for (let k = 0; k < edgeCount; k++) {
    const e = (start + k) % edgeCount;
    const a = pts[e]!;
    const b = pts[(e + 1) % n]!;
    if (labels[e] !== partLabel) {
      if (partPts.length >= 2) parts.push({ points: partPts, isLoop: false, segmentIndices: [...stroke.segmentIndices] });
      partPts = [{ ...a }];
      partLabel = labels[e]!;
    }
    partPts.push({ ...b });
  }
  if (partPts.length >= 2) parts.push({ points: partPts, isLoop: false, segmentIndices: [...stroke.segmentIndices] });
  return parts.length > 1 ? parts : [stroke];
}

interface PieceInfo {
  piece: GeoStroke;
  label: number;
  tMean: number;
  /** Projected t of the first/last point (after any orientation flip). */
  tStart: number;
  tEnd: number;
}

/** Assign a whole piece to its nearest reference and orient it along increasing reference t. */
function labelPiece(piece: GeoStroke, refs: (RefIndex | null)[]): PieceInfo | null {
  if (piece.isLoop || piece.points.length < 2) return null;
  const samples = resamplePolyline(piece.points, 12);
  let best = -1;
  let bestD = Infinity;
  let bestT = 0;
  for (let r = 0; r < refs.length; r++) {
    const ref = refs[r];
    if (!ref) continue;
    let sum = 0;
    let tSum = 0;
    for (const s of samples) {
      const proj = projectToRef(s, ref);
      sum += proj.d;
      tSum += proj.t;
    }
    if (sum < bestD) {
      bestD = sum;
      best = r;
      bestT = tSum / samples.length;
    }
  }
  if (best < 0) return null;
  const ref = refs[best]!;
  let tStart = projectToRef(piece.points[0]!, ref).t;
  let tEnd = projectToRef(piece.points[piece.points.length - 1]!, ref).t;
  if (tStart > tEnd) {
    piece.points = [...piece.points].reverse();
    [tStart, tEnd] = [tEnd, tStart];
  }
  return { piece, label: best, tMean: bestT, tStart, tEnd };
}

/**
 * Re-group assembled strokes to the reference's segmentation: split strokes
 * at reference-label seams, then chain same-reference pieces end-to-end in
 * reference arc-length order wherever their endpoints meet. Returns null when
 * nothing changed (the caller skips re-validation).
 */
export function regroupStrokesByReference(strokes: GeoStroke[], references: Point[][], options: RegroupOptions): RegroupResult | null {
  if (strokes.length === 0 || references.length === 0) return null;
  const refs = references.map(indexRef);
  if (refs.every((r) => r === null)) return null;

  // SPLIT phase. Pass-through strokes are CLONED: the merge phase reorients
  // and concatenates piece polylines, and the caller may still reject the
  // whole proposal — the heuristic originals must survive untouched.
  let splits = 0;
  const pieces: GeoStroke[] = [];
  for (const stroke of strokes) {
    const parts = splitStroke(stroke, refs, options);
    if (parts.length > 1) {
      splits++;
      pieces.push(...parts);
    } else {
      pieces.push({ points: [...stroke.points], isLoop: stroke.isLoop, segmentIndices: [...stroke.segmentIndices] });
    }
  }

  // MERGE phase: group by reference, orient by t, chain adjacent endpoints.
  const out: GeoStroke[] = [];
  const groups = new Map<number, PieceInfo[]>();
  for (const piece of pieces) {
    const info = labelPiece(piece, refs);
    if (!info) {
      out.push(piece); // loops and degenerates pass through unmerged
      continue;
    }
    const list = groups.get(info.label);
    if (list) list.push(info);
    else groups.set(info.label, [info]);
  }

  let merges = 0;
  for (const infos of groups.values()) {
    infos.sort((a, b) => a.tMean - b.tMean);
    let current: GeoStroke | null = null;
    for (const info of infos) {
      if (!current) {
        current = info.piece;
        continue;
      }
      const tail = current.points[current.points.length - 1]!;
      const head = info.piece.points[0]!;
      const gap = dist(tail, head);
      // A gap spans at most the junction ink between the two pieces (~ a
      // stroke width where they cross another stroke); anything larger means
      // the reference genuinely lifts the pen or the assignment is off.
      const tolerance = Math.max(2 * Math.max(tail.width, head.width), options.glyphDiag * 0.05);
      if (gap <= tolerance) {
        const joined = gap < 1e-6 ? info.piece.points.slice(1) : info.piece.points;
        current.points = [...current.points, ...joined];
        current.segmentIndices = [...current.segmentIndices, ...info.piece.segmentIndices];
        merges++;
      } else {
        out.push(current);
        current = info.piece;
      }
    }
    if (current) out.push(current);
  }

  if (splits === 0 && merges === 0) return null;
  return { strokes: out, splits, merges };
}
