import {
  MERGE_THRESHOLD_RATIO,
  RDP_TOLERANCE,
  SMOOTH_KINK_MIN_ANGLE,
  SMOOTH_KINK_THRESHOLD,
  SPUR_LENGTH_RATIO,
  TRACE_CURVATURE_BIAS,
  TRACE_LOOKBACK,
} from '../constants.ts';
import type { Point } from '../types.ts';

// 8-connected neighbor offsets
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

function getNeighbors(x: number, y: number, skeleton: Uint8Array, width: number, height: number): Point[] {
  const neighbors: Point[] = [];
  for (let i = 0; i < 8; i++) {
    const nx = x + DX[i]!;
    const ny = y + DY[i]!;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height && skeleton[ny * width + nx]) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  return neighbors;
}

function degree(x: number, y: number, skeleton: Uint8Array, width: number, height: number): number {
  return getNeighbors(x, y, skeleton, width, height).length;
}

function traceChain(
  startX: number,
  startY: number,
  skeleton: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  lookback: number,
  curvatureBias: number,
): Point[] {
  const chain: Point[] = [{ x: startX, y: startY }];
  visited[startY * width + startX] = 1;

  let cx = startX;
  let cy = startY;

  while (true) {
    const neighbors = getNeighbors(cx, cy, skeleton, width, height);
    const unvisited = neighbors.filter((n) => !visited[n.y * width + n.x]);

    if (unvisited.length === 0) {
      // No unvisited neighbors -- but if there's an already-visited junction nearby,
      // append it so this chain connects to the chain that passed through the junction.
      const visitedJunction = neighbors.find((n) => visited[n.y * width + n.x] && degree(n.x, n.y, skeleton, width, height) >= 3);
      if (visitedJunction) chain.push(visitedJunction);
      break;
    }

    let next: Point;
    if (chain.length >= 2 && unvisited.length > 1) {
      // Multiple choices — use curvature-aware direction to pick the straightest
      const { dirX, dirY } = estimateDirection(chain, cx, cy, lookback, curvatureBias);
      next = pickStraightest(unvisited, cx, cy, dirX, dirY, skeleton, visited, width, height, lookback);
    } else if (unvisited.length === 1) {
      next = unvisited[0]!;
    } else {
      // No direction yet — prefer chain pixels (degree 2) over junctions
      next = unvisited.find((n) => degree(n.x, n.y, skeleton, width, height) <= 2) ?? unvisited[0]!;
    }

    visited[next.y * width + next.x] = 1;
    chain.push(next);
    cx = next.x;
    cy = next.y;

    // Stop at endpoints (degree 1). Continue through junctions — the direction
    // estimation above picks the correct branch.
    if (degree(cx, cy, skeleton, width, height) <= 1) break;
  }

  return chain;
}

/**
 * Estimate the direction of travel at the end of a chain, accounting for curvature.
 *
 * Splits the lookback window into two halves (older and recent) and computes the
 * average direction vector for each. The final direction is:
 *   dir = recent + curvatureBias * (recent - older)
 *
 * - curvatureBias = 0: pure tangent from the recent half (ignores curvature)
 * - curvatureBias = 0.5: moderate extrapolation of the angular trend
 * - curvatureBias = 1: full extrapolation (predicts continued turning at same rate)
 * - curvatureBias > 1: over-extrapolation (predicts tighter turn)
 */
function estimateDirection(
  chain: Point[],
  cx: number,
  cy: number,
  lookback: number,
  curvatureBias: number,
): { dirX: number; dirY: number } {
  const n = chain.length;
  const windowSize = Math.min(n - 1, lookback);

  if (windowSize < 4 || curvatureBias === 0) {
    // Not enough points for two-half split, or curvature disabled — use simple lookback
    const prev = chain[n - 1 - windowSize]!;
    return { dirX: cx - prev.x, dirY: cy - prev.y };
  }

  // Split window into older half and recent half
  const halfSize = Math.floor(windowSize / 2);
  const midPoint = chain[n - 1 - halfSize]!;
  const oldPoint = chain[n - 1 - windowSize]!;

  // Older half direction: oldPoint → midPoint
  const oldDirX = midPoint.x - oldPoint.x;
  const oldDirY = midPoint.y - oldPoint.y;

  // Recent half direction: midPoint → current
  const recentDirX = cx - midPoint.x;
  const recentDirY = cy - midPoint.y;

  // Extrapolate: recent + bias * (recent - older)
  return {
    dirX: recentDirX + curvatureBias * (recentDirX - oldDirX),
    dirY: recentDirY + curvatureBias * (recentDirY - oldDirY),
  };
}

/**
 * Among candidate neighbors, pick the one whose branch best continues the
 * estimated direction (dirX, dirY).
 *
 * Instead of comparing only the immediate 1-pixel step (which gives just 8
 * possible angles), follows each candidate branch ahead by `lookback` pixels
 * to compute the actual branch direction, then picks the best cosine match.
 */
function pickStraightest(
  candidates: Point[],
  cx: number,
  cy: number,
  dirX: number,
  dirY: number,
  skeleton: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  lookback: number,
): Point {
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
  let best = candidates[0]!;
  let bestCos = -2;

  for (const c of candidates) {
    // Follow this branch ahead to get a real direction vector
    const ahead = peekAhead(cx, cy, c, skeleton, visited, width, height, lookback);
    const cdx = ahead.x - cx;
    const cdy = ahead.y - cy;
    const cLen = Math.sqrt(cdx * cdx + cdy * cdy);
    if (dirLen === 0 || cLen === 0) continue;
    const cos = (dirX * cdx + dirY * cdy) / (dirLen * cLen);
    if (cos > bestCos) {
      bestCos = cos;
      best = c;
    }
  }

  return best;
}

/**
 * Follow a branch from (cx,cy) through `start` for up to `steps` pixels
 * without modifying visited state. Returns the furthest point reached.
 */
function peekAhead(
  cx: number,
  cy: number,
  start: Point,
  skeleton: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  steps: number,
): Point {
  let px = cx;
  let py = cy;
  let x = start.x;
  let y = start.y;

  for (let step = 0; step < steps; step++) {
    const neighbors = getNeighbors(x, y, skeleton, width, height);
    // Exclude where we came from and already-visited pixels (except the first step
    // where `start` itself may be unvisited — we just don't go backwards)
    const forward = neighbors.filter((n) => (n.x !== px || n.y !== py) && !visited[n.y * width + n.x]);

    if (forward.length === 0) break;

    // Pick the neighbor most aligned with current direction (simple 1-step for peek)
    const dx = x - px;
    const dy = y - py;
    let nextP = forward[0]!;
    if (forward.length > 1 && (dx !== 0 || dy !== 0)) {
      const dLen = Math.sqrt(dx * dx + dy * dy);
      let bestC = -2;
      for (const f of forward) {
        const fdx = f.x - x;
        const fdy = f.y - y;
        const fLen = Math.sqrt(fdx * fdx + fdy * fdy);
        if (fLen === 0) continue;
        const c = (dx * fdx + dy * fdy) / (dLen * fLen);
        if (c > bestC) {
          bestC = c;
          nextP = f;
        }
      }
    }

    px = x;
    py = y;
    x = nextP.x;
    y = nextP.y;
  }

  return { x, y };
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  const ex = point.x - projX;
  const ey = point.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

export function rdpSimplify(points: Point[], tolerance = RDP_TOLERANCE): Point[] {
  if (points.length <= 2) return points;

  const first = points[0]!;
  const last = points[points.length - 1]!;

  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i]!, first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), tolerance);
    const right = rdpSimplify(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Merge polylines whose endpoints are within `threshold` distance into longer chains.
 * This reconnects fragments split at junction points by the tracing algorithm.
 */
function mergePolylines(polylines: Point[][], threshold: number): Point[][] {
  if (polylines.length <= 1) return polylines;

  const used = new Uint8Array(polylines.length);
  const merged: Point[][] = [];

  for (let i = 0; i < polylines.length; i++) {
    if (used[i]) continue;
    used[i] = 1;

    let chain = [...polylines[i]!];
    let changed = true;

    while (changed) {
      changed = false;
      for (let j = 0; j < polylines.length; j++) {
        if (used[j]) continue;
        const other = polylines[j]!;

        const chainStart = chain[0]!;
        const chainEnd = chain[chain.length - 1]!;
        const otherStart = other[0]!;
        const otherEnd = other[other.length - 1]!;

        // Try all 4 orientations of joining
        if (dist(chainEnd, otherStart) < threshold) {
          chain = [...chain, ...other.slice(1)];
        } else if (dist(chainEnd, otherEnd) < threshold) {
          chain = [...chain, ...[...other].reverse().slice(1)];
        } else if (dist(chainStart, otherEnd) < threshold) {
          chain = [...other, ...chain.slice(1)];
        } else if (dist(chainStart, otherStart) < threshold) {
          chain = [...[...other].reverse(), ...chain.slice(1)];
        } else {
          continue;
        }

        used[j] = 1;
        changed = true;
      }
    }

    merged.push(chain);
  }

  return merged;
}

/**
 * Smooth junction kinks in merged polylines using curvature-aware detection.
 *
 * Three removal criteria (any one triggers removal):
 *
 * 1. **Classic angle test**: the angle at curr (prev→curr→next) is nearly
 *    straight (>= minAngle). Catches obvious kinks.
 *
 * 2. **Curvature prediction test**: uses the lookback window + curvature bias
 *    to estimate the expected direction. Removes curr if skipping it aligns
 *    significantly better with the predicted curve.
 *
 * 3. **Smoothness test**: if removing curr makes the angle at prev smoother
 *    (closer to 180°), curr is a junction detour that disrupts the path.
 */
function smoothJunctionKinks(
  polyline: Point[],
  lookback: number,
  curvatureBias: number,
  minAngle = (SMOOTH_KINK_MIN_ANGLE * Math.PI) / 180,
): Point[] {
  if (polyline.length <= 2) return polyline;

  const result: Point[] = [polyline[0]!];

  for (let i = 1; i < polyline.length - 1; i++) {
    const prev = result[result.length - 1]!;
    const curr = polyline[i]!;
    const next = polyline[i + 1]!;

    // Vectors from curr to prev and curr to next
    const ax = prev.x - curr.x;
    const ay = prev.y - curr.y;
    const bx = next.x - curr.x;
    const by = next.y - curr.y;

    const magA = Math.sqrt(ax * ax + ay * ay);
    const magB = Math.sqrt(bx * bx + by * by);

    if (magA === 0 || magB === 0) {
      continue; // degenerate — skip duplicate point
    }

    // 1. Classic angle test: remove nearly-straight kinks
    const cosAngle = (ax * bx + ay * by) / (magA * magB);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    if (angle >= minAngle) {
      continue;
    }

    // 2. Curvature prediction test: does removing this point improve alignment
    // with the expected curve?
    if (result.length >= 3) {
      const { dirX, dirY } = estimateDirection(result, prev.x, prev.y, lookback, curvatureBias);
      const predLen = Math.sqrt(dirX * dirX + dirY * dirY);

      if (predLen > 0) {
        const skipX = next.x - prev.x;
        const skipY = next.y - prev.y;
        const skipLen = Math.sqrt(skipX * skipX + skipY * skipY);

        const toCurrX = curr.x - prev.x;
        const toCurrY = curr.y - prev.y;
        const toCurrLen = Math.sqrt(toCurrX * toCurrX + toCurrY * toCurrY);

        if (skipLen > 0 && toCurrLen > 0) {
          const cosSkip = (dirX * skipX + dirY * skipY) / (predLen * skipLen);
          const cosThrough = (dirX * toCurrX + dirY * toCurrY) / (predLen * toCurrLen);

          if (cosSkip - cosThrough > SMOOTH_KINK_THRESHOLD) {
            continue;
          }
        }
      }
    }

    // 3. Smoothness test: does removing curr make the angle at prev smoother?
    // Compare the angle at prev going through curr vs skipping to next directly.
    if (result.length >= 2) {
      const prevPrev = result[result.length - 2]!;

      // Angle at prev WITH curr: prevPrev → prev → curr
      const withX = curr.x - prev.x;
      const withY = curr.y - prev.y;
      const withLen = Math.sqrt(withX * withX + withY * withY);

      // Angle at prev WITHOUT curr: prevPrev → prev → next
      const withoutX = next.x - prev.x;
      const withoutY = next.y - prev.y;
      const withoutLen = Math.sqrt(withoutX * withoutX + withoutY * withoutY);

      const inX = prev.x - prevPrev.x;
      const inY = prev.y - prevPrev.y;
      const inLen = Math.sqrt(inX * inX + inY * inY);

      if (inLen > 0 && withLen > 0 && withoutLen > 0) {
        // Cosine at prev going through curr (higher = straighter = smoother)
        const cosWithCurr = (inX * withX + inY * withY) / (inLen * withLen);
        // Cosine at prev skipping to next (higher = straighter = smoother)
        const cosWithout = (inX * withoutX + inY * withoutY) / (inLen * withoutLen);

        // If skipping curr makes prev's angle significantly smoother, remove curr
        if (cosWithout - cosWithCurr > SMOOTH_KINK_THRESHOLD) {
          continue;
        }
      }
    }

    result.push(curr);
  }

  result.push(polyline[polyline.length - 1]!);
  return result;
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

export function traceAndSimplify(
  skeleton: Uint8Array,
  width: number,
  height: number,
  rdpTolerance = RDP_TOLERANCE,
  spurMinLength?: number,
  lookback = TRACE_LOOKBACK,
  curvatureBias = TRACE_CURVATURE_BIAS,
): Point[][] {
  const visited = new Uint8Array(width * height);
  const polylines: Point[][] = [];

  // First pass: start from endpoints (degree 1)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!skeleton[y * width + x] || visited[y * width + x]) continue;
      if (degree(x, y, skeleton, width, height) === 1) {
        const chain = traceChain(x, y, skeleton, visited, width, height, lookback, curvatureBias);
        if (chain.length > 1) polylines.push(chain);
      }
    }
  }

  // Second pass: handle remaining unvisited pixels (loops, junctions, isolated pixels).
  // Single-point chains are kept here because traceChain marks pixels visited even when
  // the chain is too short — isolated pixels (e.g. restored compact shapes like dots)
  // would otherwise be lost.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!skeleton[y * width + x] || visited[y * width + x]) continue;
      const chain = traceChain(x, y, skeleton, visited, width, height, lookback, curvatureBias);
      if (chain.length >= 1) polylines.push(chain);
    }
  }

  // Merge chains whose endpoints are close (reconnects fragments split at junctions)
  const mergeThreshold = Math.max(width, height) * MERGE_THRESHOLD_RATIO;
  const mergedPolylines = mergePolylines(polylines, mergeThreshold);

  // Smooth out junction kinks introduced by Zhang-Suen at branch points
  const smoothed = mergedPolylines.map((p) => smoothJunctionKinks(p, lookback, curvatureBias));

  // Compute spur length threshold: proportional to bitmap size, but capped so tiny glyphs aren't fully erased
  const effectiveSpurMin = spurMinLength ?? Math.min(Math.round(Math.max(width, height) * SPUR_LENGTH_RATIO), 10);

  // Prune short spurs, but preserve isolated short components (e.g. dots in "i", "j").
  // A true spur is a short branch connected to a longer stroke. An isolated component
  // whose endpoints aren't near any other polyline is a legitimate feature.
  const pruned = smoothed.filter((p) => {
    if (pathLength(p) >= effectiveSpurMin) return true;
    // Keep this short polyline if it's isolated (not connected to any other polyline)
    const pStart = p[0]!;
    const pEnd = p[p.length - 1]!;
    const isConnected = smoothed.some((other) => {
      if (other === p) return false;
      const oStart = other[0]!;
      const oEnd = other[other.length - 1]!;
      return (
        dist(pStart, oStart) < mergeThreshold ||
        dist(pStart, oEnd) < mergeThreshold ||
        dist(pEnd, oStart) < mergeThreshold ||
        dist(pEnd, oEnd) < mergeThreshold
      );
    });
    return !isConnected;
  });

  // Simplify with RDP
  return pruned.map((p) => rdpSimplify(p, rdpTolerance));
}
