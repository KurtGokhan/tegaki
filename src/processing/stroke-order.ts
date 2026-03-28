import type { Point, Stroke, TimedPoint } from '../types.ts';
import { getStrokeWidth } from './width.ts';

interface StrokeComponent {
  polylines: Point[][];
  minY: number;
  minX: number;
}

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
 * Group polylines into connected components.
 * Two polylines are in the same component if any of their endpoints are within `threshold` distance.
 */
function groupComponents(polylines: Point[][], threshold: number): StrokeComponent[] {
  const n = polylines.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  }

  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Union polylines with nearby endpoints
  for (let i = 0; i < n; i++) {
    const pi = polylines[i]!;
    const piStart = pi[0]!;
    const piEnd = pi[pi.length - 1]!;

    for (let j = i + 1; j < n; j++) {
      const pj = polylines[j]!;
      const pjStart = pj[0]!;
      const pjEnd = pj[pj.length - 1]!;

      if (
        dist(piStart, pjStart) < threshold ||
        dist(piStart, pjEnd) < threshold ||
        dist(piEnd, pjStart) < threshold ||
        dist(piEnd, pjEnd) < threshold
      ) {
        union(i, j);
      }
    }
  }

  // Group by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const components: StrokeComponent[] = [];
  for (const indices of groups.values()) {
    const componentPolylines = indices.map((i) => polylines[i]!);
    let minY = Infinity;
    let minX = Infinity;
    for (const poly of componentPolylines) {
      for (const p of poly) {
        if (p.y < minY) minY = p.y;
        if (p.x < minX) minX = p.x;
      }
    }
    components.push({ polylines: componentPolylines, minY, minX });
  }

  return components;
}

/**
 * Orient a polyline so the "natural" starting point comes first.
 * Preference: start from top-left (top takes priority, then left).
 */
function orientPolyline(points: Point[]): Point[] {
  if (points.length < 2) return points;

  const start = points[0]!;
  const end = points[points.length - 1]!;

  // Prefer starting from the top (smaller y in pixel coords)
  // If similar y, prefer starting from the left (smaller x)
  const startScore = start.y - start.x * 0.3;
  const endScore = end.y - end.x * 0.3;

  if (endScore < startScore) {
    return [...points].reverse();
  }
  return points;
}

export function orderStrokes(polylines: Point[][], inverseDT: Float32Array | null, bitmapWidth: number, connectionThreshold = 3): Stroke[] {
  if (polylines.length === 0) return [];

  // Group into connected components
  const components = groupComponents(polylines, connectionThreshold);

  // Sort components: top-to-bottom, then left-to-right
  components.sort((a, b) => {
    const yDiff = a.minY - b.minY;
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.minX - b.minX;
  });

  const strokes: Stroke[] = [];
  let order = 0;

  for (const component of components) {
    // Sort polylines within component similarly
    const sorted = [...component.polylines].sort((a, b) => {
      const aMinY = Math.min(...a.map((p) => p.y));
      const bMinY = Math.min(...b.map((p) => p.y));
      const yDiff = aMinY - bMinY;
      if (Math.abs(yDiff) > 3) return yDiff;
      const aMinX = Math.min(...a.map((p) => p.x));
      const bMinX = Math.min(...b.map((p) => p.x));
      return aMinX - bMinX;
    });

    for (const polyline of sorted) {
      const oriented = orientPolyline(polyline);
      const totalLen = pathLength(oriented);

      // Assign t parameter and width
      let cumLen = 0;
      const points: TimedPoint[] = oriented.map((p, i) => {
        if (i > 0) {
          cumLen += dist(oriented[i - 1]!, p);
        }
        const t = totalLen > 0 ? cumLen / totalLen : 0;
        const width = inverseDT ? getStrokeWidth(p.x, p.y, inverseDT, bitmapWidth) : 1;
        return { x: p.x, y: p.y, t, width };
      });

      strokes.push({ points, order: order++ });
    }
  }

  return strokes;
}
