/**
 * Centripetal Catmull-Rom spline sampling.
 *
 * A point is `[x, y, w]` — the same shape the stroke data uses — but the
 * third channel is carried through the interpolation opaquely, so this
 * module is self-contained and doesn't know about strokes or glyph data.
 */

/** A 3-channel point `[x, y, w]`. Typed as a plain array to match the loose shape used by the glyph data format. */
export type Point3 = readonly number[];

export interface SmoothSample {
  x: number;
  y: number;
  /** Third channel (stroke width in the caller's use) interpolated on the same parameterization as x/y. */
  width: number;
}

/**
 * Sample `count` points along a centripetal Catmull-Rom segment from `p1` to
 * `p2`, with neighbor control points `p0` and `p3`. Samples are emitted at
 * `u = k/count` for `k = 1..count`, so the last sample equals `p2`.
 *
 * Centripetal parameterization (α = 0.5) avoids the cusps and self-loops that
 * uniform/chordal Catmull-Rom can produce on sharp corners — relevant for the
 * baked RDP-simplified polylines the renderer consumes.
 *
 * For endpoint segments where a neighbor is missing, pass a phantom point
 * built with {@link reflect}. Zero-length chords are clamped to a tiny epsilon
 * so the knot parameterization stays non-degenerate.
 */
export function sampleCatmullRom(p0: Point3, p1: Point3, p2: Point3, p3: Point3, count: number): SmoothSample[] {
  const d01 = Math.max(dist(p0, p1), 1e-6);
  const d12 = Math.max(dist(p1, p2), 1e-6);
  const d23 = Math.max(dist(p2, p3), 1e-6);
  const t0 = 0;
  const t1 = t0 + Math.sqrt(d01);
  const t2 = t1 + Math.sqrt(d12);
  const t3 = t2 + Math.sqrt(d23);

  const out: SmoothSample[] = new Array(count);
  for (let k = 1; k <= count; k++) {
    const u = k / count;
    const t = t1 + u * (t2 - t1);
    out[k - 1] = evalBarryGoldman(p0, p1, p2, p3, t0, t1, t2, t3, t);
  }
  return out;
}

/**
 * Reflect `p` across `anchor` to produce a phantom neighbor for endpoint
 * segments. The result lies on the extension of (p, anchor) past `anchor` at
 * the same distance — equivalent to a zero-curvature extrapolation, which
 * gives a natural straight start/end tangent.
 */
export function reflect(anchor: Point3, p: Point3): Point3 {
  return [2 * anchor[0]! - p[0]!, 2 * anchor[1]! - p[1]!, anchor[2]!];
}

function dist(a: Point3, b: Point3): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  return Math.sqrt(dx * dx + dy * dy);
}

// Barry-Goldman pyramid evaluation of a Catmull-Rom segment between p1 and p2
// at knot value t ∈ [t1, t2]. Applies the same interpolation to x, y, and the
// third channel so they stay smooth together.
function evalBarryGoldman(
  p0: Point3,
  p1: Point3,
  p2: Point3,
  p3: Point3,
  t0: number,
  t1: number,
  t2: number,
  t3: number,
  t: number,
): SmoothSample {
  const a1x = lerp(p0[0]!, p1[0]!, t0, t1, t);
  const a1y = lerp(p0[1]!, p1[1]!, t0, t1, t);
  const a1w = lerp(p0[2]!, p1[2]!, t0, t1, t);
  const a2x = lerp(p1[0]!, p2[0]!, t1, t2, t);
  const a2y = lerp(p1[1]!, p2[1]!, t1, t2, t);
  const a2w = lerp(p1[2]!, p2[2]!, t1, t2, t);
  const a3x = lerp(p2[0]!, p3[0]!, t2, t3, t);
  const a3y = lerp(p2[1]!, p3[1]!, t2, t3, t);
  const a3w = lerp(p2[2]!, p3[2]!, t2, t3, t);
  const b1x = lerp(a1x, a2x, t0, t2, t);
  const b1y = lerp(a1y, a2y, t0, t2, t);
  const b1w = lerp(a1w, a2w, t0, t2, t);
  const b2x = lerp(a2x, a3x, t1, t3, t);
  const b2y = lerp(a2y, a3y, t1, t3, t);
  const b2w = lerp(a2w, a3w, t1, t3, t);
  return {
    x: lerp(b1x, b2x, t1, t2, t),
    y: lerp(b1y, b2y, t1, t2, t),
    width: lerp(b1w, b2w, t1, t2, t),
  };
}

function lerp(a: number, b: number, ta: number, tb: number, t: number): number {
  const span = tb - ta;
  if (span === 0) return a;
  return a + (b - a) * ((t - ta) / span);
}
