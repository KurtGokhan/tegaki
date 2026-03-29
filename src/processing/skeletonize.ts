import { JUNCTION_CLEANUP_MAX_ITERATIONS, SKELETON_METHOD, THIN_MAX_ITERATIONS } from '../constants.ts';
import { skimageSkeletonize } from './skimage-bridge.ts';
import { computeInverseDistanceTransform } from './width.ts';

// 8-connected neighbor offsets
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

function degree(x: number, y: number, skel: Uint8Array, w: number, h: number): number {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    const nx = x + DX[i]!;
    const ny = y + DY[i]!;
    if (nx >= 0 && nx < w && ny >= 0 && ny < h && skel[ny * w + nx]) count++;
  }
  return count;
}

/**
 * Skeletonize a binary bitmap using Zhang-Suen thinning,
 * then clean up junction clusters using the distance transform.
 *
 * Zhang-Suen produces topologically correct skeletons but junction pixels
 * tend to cluster at morphological centers rather than lying on the true
 * medial axis. The cleanup step collapses each junction cluster to the
 * single pixel with the highest distance transform value (closest to the
 * true medial axis), then reconnects the arms.
 */
export async function skeletonize(bitmap: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const dt = computeInverseDistanceTransform(bitmap, width, height);

  if (SKELETON_METHOD === 'medial-axis') {
    return medialAxisThin(bitmap, dt, width, height);
  }

  // scikit-image backed methods — delegate to Python subprocess
  if (SKELETON_METHOD.startsWith('skimage-')) {
    const skimageMethod = SKELETON_METHOD.replace('skimage-', '') as 'zhang' | 'lee' | 'medial-axis' | 'thin';
    const skeleton = await skimageSkeletonize(
      bitmap,
      width,
      height,
      skimageMethod,
      skimageMethod === 'thin' ? THIN_MAX_ITERATIONS : undefined,
    );
    return cleanJunctionClusters(skeleton, dt, width, height, zhangSuenThin);
  }

  // TypeScript implementations
  const thinFns: Record<string, ThinFn> = {
    'zhang-suen': zhangSuenThin,
    'guo-hall': guoHallThin,
    lee: leeThin,
    thin: (bmp, w, h) => morphologicalThin(bmp, w, h, THIN_MAX_ITERATIONS),
  };
  const thinFn = thinFns[SKELETON_METHOD] ?? zhangSuenThin;
  const skeleton = thinFn(bitmap, width, height);
  return cleanJunctionClusters(skeleton, dt, width, height, thinFn);
}

/**
 * Find and collapse junction clusters, iterating until stable.
 *
 * Each pass: find connected groups of degree-3+ pixels, collapse each to
 * the highest-DT pixel, reconnect arms via Bresenham, then Zhang-Suen thin.
 * Repeat because thinning can reintroduce clusters from reconnection lines.
 */
type ThinFn = (bitmap: Uint8Array, width: number, height: number) => Uint8Array;

function cleanJunctionClusters(skeleton: Uint8Array, dt: Float32Array, width: number, height: number, thin: ThinFn): Uint8Array {
  let current = skeleton;

  for (let iter = 0; iter < JUNCTION_CLEANUP_MAX_ITERATIONS; iter++) {
    const result = collapseClusterPass(current, dt, width, height);
    if (!result) break; // no clusters found
    current = thin(result, width, height);
  }

  return current;
}

/**
 * Single pass: find multi-pixel junction clusters and collapse each to one pixel.
 * Returns null if no clusters were found.
 */
function collapseClusterPass(skeleton: Uint8Array, dt: Float32Array, width: number, height: number): Uint8Array | null {
  const result = new Uint8Array(skeleton);

  // Find all junction pixels
  const isJunction = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (result[y * width + x] && degree(x, y, result, width, height) >= 3) {
        isJunction[y * width + x] = 1;
      }
    }
  }

  // Flood-fill to find connected clusters of junction pixels
  const visited = new Uint8Array(width * height);
  let foundCluster = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isJunction[y * width + x] || visited[y * width + x]) continue;

      // BFS to collect all junction pixels in this cluster
      const cluster: { x: number; y: number; idx: number }[] = [];
      const queue: { x: number; y: number }[] = [{ x, y }];
      visited[y * width + x] = 1;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const idx = curr.y * width + curr.x;
        cluster.push({ x: curr.x, y: curr.y, idx });

        for (let i = 0; i < 8; i++) {
          const nx = curr.x + DX[i]!;
          const ny = curr.y + DY[i]!;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (isJunction[nIdx] && !visited[nIdx]) {
            visited[nIdx] = 1;
            queue.push({ x: nx, y: ny });
          }
        }
      }

      if (cluster.length <= 1) continue; // Single junction pixel, nothing to clean
      foundCluster = true;

      // Find the cluster pixel with highest DT value (true medial axis center)
      let bestIdx = cluster[0]!.idx;
      let bestDt = dt[bestIdx]!;
      for (const p of cluster) {
        if (dt[p.idx]! > bestDt) {
          bestDt = dt[p.idx]!;
          bestIdx = p.idx;
        }
      }

      // Find arm pixels: non-junction skeleton pixels adjacent to the cluster
      const arms: { x: number; y: number }[] = [];
      const clusterSet = new Set(cluster.map((p) => p.idx));

      for (const p of cluster) {
        for (let i = 0; i < 8; i++) {
          const nx = p.x + DX[i]!;
          const ny = p.y + DY[i]!;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (result[nIdx] && !clusterSet.has(nIdx)) {
            arms.push({ x: nx, y: ny });
          }
        }
      }

      // Remove all cluster pixels
      for (const p of cluster) {
        result[p.idx] = 0;
      }

      // Re-add the best pixel
      result[bestIdx] = 1;
      const bestX = bestIdx % width;
      const bestY = (bestIdx - bestX) / width;

      // Reconnect arms to the best pixel by drawing 1px-wide lines
      for (const arm of arms) {
        bresenham(result, bestX, bestY, arm.x, arm.y, width);
      }
    }
  }

  return foundCluster ? result : null;
}

/**
 * Draw a 1-pixel line between two points using Bresenham's algorithm.
 */
function bresenham(bitmap: Uint8Array, x0: number, y0: number, x1: number, y1: number, width: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0;
  let cy = y0;

  while (true) {
    bitmap[cy * width + cx] = 1;
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

/**
 * Distance-ordered homotopic thinning (medial axis extraction).
 *
 * Removes foreground pixels from boundary inward, ordered by distance
 * transform value (smallest first). Each pixel is only removed if it's
 * a "simple point" — its removal doesn't change the topology (doesn't
 * disconnect the skeleton or create holes).
 *
 * Because high-DT pixels (on the medial axis) are removed last, the
 * resulting skeleton lies on the true medial axis of the shape.
 */
function medialAxisThin(bitmap: Uint8Array, dt: Float32Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(bitmap);

  // Collect all foreground pixels with their DT values
  const pixels: { idx: number; dt: number }[] = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i]) {
      pixels.push({ idx: i, dt: dt[i]! });
    }
  }

  // Sort by DT ascending — remove boundary pixels first, preserve medial axis last
  pixels.sort((a, b) => a.dt - b.dt);

  for (const { idx } of pixels) {
    if (!result[idx]) continue; // already removed
    const x = idx % width;
    const y = (idx - x) / width;

    // Don't remove endpoints (degree <= 1) — preserves skeleton branches
    const deg = degree(x, y, result, width, height);
    if (deg <= 1) continue;

    // Simple point test: pixel can be removed without changing topology
    // A pixel is simple if the number of 8-connected foreground components
    // in its 3x3 neighborhood is exactly 1 (equivalent to A(P) = 1,
    // the 0→1 transition count used in Zhang-Suen).
    if (isSimplePoint(x, y, result, width, height)) {
      result[idx] = 0;
    }
  }

  return result;
}

/**
 * Check if a pixel is a simple point (topology-preserving removal).
 * A foreground pixel is simple if removing it doesn't change the number
 * of connected components or create/destroy holes.
 *
 * Uses the crossing number: count 0→1 transitions in the ordered
 * 8-neighbor sequence. If exactly 1, the pixel is simple.
 */
function isSimplePoint(x: number, y: number, bitmap: Uint8Array, width: number, height: number): boolean {
  const get = (nx: number, ny: number): number => {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return 0;
    return bitmap[ny * width + nx]!;
  };

  const p2 = get(x, y - 1);
  const p3 = get(x + 1, y - 1);
  const p4 = get(x + 1, y);
  const p5 = get(x + 1, y + 1);
  const p6 = get(x, y + 1);
  const p7 = get(x - 1, y + 1);
  const p8 = get(x - 1, y);
  const p9 = get(x - 1, y - 1);

  // Count 0→1 transitions in clockwise order
  const seq = [p2, p3, p4, p5, p6, p7, p8, p9];
  let transitions = 0;
  for (let i = 0; i < 8; i++) {
    if (seq[i] === 0 && seq[(i + 1) % 8] === 1) transitions++;
  }

  return transitions === 1;
}

/**
 * Guo-Hall thinning algorithm (1989).
 * Two sub-iterations per pass, like Zhang-Suen, but uses paired-neighbor
 * counting: N = min(N1, N2) where N1 and N2 group adjacent neighbor pairs
 * with different offsets. This can produce slightly different junction
 * topology and thinner diagonal strokes compared to Zhang-Suen.
 */
export function guoHallThin(bitmap: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(bitmap);

  const get = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return result[y * width + x]!;
  };

  let changed = true;
  while (changed) {
    changed = false;

    // Sub-iteration 1
    const toDelete1: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (result[y * width + x] === 0) continue;

        const p2 = get(x, y - 1);
        const p3 = get(x + 1, y - 1);
        const p4 = get(x + 1, y);
        const p5 = get(x + 1, y + 1);
        const p6 = get(x, y + 1);
        const p7 = get(x - 1, y + 1);
        const p8 = get(x - 1, y);
        const p9 = get(x - 1, y - 1);

        // C(P): number of 0→1 transitions in the ordered sequence
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9];
        let C = 0;
        for (let i = 0; i < 8; i++) {
          if (seq[i] === 0 && seq[(i + 1) % 8] === 1) C++;
        }
        if (C !== 1) continue;

        // N = min(N1, N2) using paired-neighbor groupings
        const n1 = (p9 | p2) + (p3 | p4) + (p5 | p6) + (p7 | p8);
        const n2 = (p2 | p3) + (p4 | p5) + (p6 | p7) + (p8 | p9);
        const N = Math.min(n1, n2);
        if (N < 2 || N > 3) continue;

        // Sub-iteration 1 condition
        if ((p2 | p3) & (p6 | p7)) continue;

        toDelete1.push(y * width + x);
      }
    }
    for (const idx of toDelete1) {
      result[idx] = 0;
      changed = true;
    }

    // Sub-iteration 2
    const toDelete2: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (result[y * width + x] === 0) continue;

        const p2 = get(x, y - 1);
        const p3 = get(x + 1, y - 1);
        const p4 = get(x + 1, y);
        const p5 = get(x + 1, y + 1);
        const p6 = get(x, y + 1);
        const p7 = get(x - 1, y + 1);
        const p8 = get(x - 1, y);
        const p9 = get(x - 1, y - 1);

        const seq = [p2, p3, p4, p5, p6, p7, p8, p9];
        let C = 0;
        for (let i = 0; i < 8; i++) {
          if (seq[i] === 0 && seq[(i + 1) % 8] === 1) C++;
        }
        if (C !== 1) continue;

        const n1 = (p9 | p2) + (p3 | p4) + (p5 | p6) + (p7 | p8);
        const n2 = (p2 | p3) + (p4 | p5) + (p6 | p7) + (p8 | p9);
        const N = Math.min(n1, n2);
        if (N < 2 || N > 3) continue;

        // Sub-iteration 2 condition
        if ((p4 | p5) & (p8 | p9)) continue;

        toDelete2.push(y * width + x);
      }
    }
    for (const idx of toDelete2) {
      result[idx] = 0;
      changed = true;
    }
  }

  return result;
}

/**
 * Build a 256-entry lookup table for topology-preserving pixel removal.
 * Index is the 8-bit encoding of the 3×3 neighborhood (P2..P9 mapped to bits 0..7).
 * A pixel is removable if: 2 ≤ B(P) ≤ 6 and A(P) = 1.
 */
function buildRemovalLUT(): Uint8Array {
  const lut = new Uint8Array(256);

  for (let i = 0; i < 256; i++) {
    const p2 = (i >> 0) & 1;
    const p3 = (i >> 1) & 1;
    const p4 = (i >> 2) & 1;
    const p5 = (i >> 3) & 1;
    const p6 = (i >> 4) & 1;
    const p7 = (i >> 5) & 1;
    const p8 = (i >> 6) & 1;
    const p9 = (i >> 7) & 1;

    const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
    if (B < 2 || B > 6) continue;

    const seq = [p2, p3, p4, p5, p6, p7, p8, p9];
    let A = 0;
    for (let j = 0; j < 8; j++) {
      if (seq[j] === 0 && seq[(j + 1) % 8] === 1) A++;
    }
    if (A !== 1) continue;

    lut[i] = 1;
  }

  return lut;
}

/** Encode 8-connected neighborhood as an 8-bit index: P2(N)=bit0 … P9(NW)=bit7 */
function encodeNeighborhood(x: number, y: number, bitmap: Uint8Array, width: number, height: number): number {
  let code = 0;
  if (y > 0 && bitmap[(y - 1) * width + x]) code |= 1;
  if (y > 0 && x < width - 1 && bitmap[(y - 1) * width + x + 1]) code |= 2;
  if (x < width - 1 && bitmap[y * width + x + 1]) code |= 4;
  if (y < height - 1 && x < width - 1 && bitmap[(y + 1) * width + x + 1]) code |= 8;
  if (y < height - 1 && bitmap[(y + 1) * width + x]) code |= 16;
  if (y < height - 1 && x > 0 && bitmap[(y + 1) * width + x - 1]) code |= 32;
  if (x > 0 && bitmap[y * width + x - 1]) code |= 64;
  if (y > 0 && x > 0 && bitmap[(y - 1) * width + x - 1]) code |= 128;
  return code;
}

// Precompute once at module level
const REMOVAL_LUT = buildRemovalLUT();

// 8 border directions for Lee/morphological thinning
const BORDER_DIRS = [
  { dx: 0, dy: -1 }, // N
  { dx: 1, dy: -1 }, // NE
  { dx: 1, dy: 0 }, // E
  { dx: 1, dy: 1 }, // SE
  { dx: 0, dy: 1 }, // S
  { dx: -1, dy: 1 }, // SW
  { dx: -1, dy: 0 }, // W
  { dx: -1, dy: -1 }, // NW
];

/**
 * Lee's thinning algorithm adapted for 2D (Lee, Kashyap & Chu, 1994).
 *
 * Uses a precomputed lookup table with 8 directional sub-iterations per pass.
 * Each sub-iteration only considers border pixels from one direction (N, NE, E,
 * SE, S, SW, W, NW) and removes those whose 3×3 neighborhood passes the LUT
 * topology check (A=1, 2≤B≤6).
 *
 * The 8-directional sweep reduces directional bias compared to Zhang-Suen's
 * 2 sub-iterations, producing more symmetric skeletons with cleaner junctions.
 */
export function leeThin(bitmap: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(bitmap);

  let changed = true;
  while (changed) {
    changed = false;

    for (const dir of BORDER_DIRS) {
      const toDelete: number[] = [];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (result[idx] === 0) continue;

          // Only process border pixels for this direction
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && result[ny * width + nx] !== 0) continue;

          const neighbors = encodeNeighborhood(x, y, result, width, height);
          if (REMOVAL_LUT[neighbors]) {
            toDelete.push(idx);
          }
        }
      }

      for (const idx of toDelete) {
        result[idx] = 0;
        changed = true;
      }
    }
  }

  return result;
}

/**
 * Morphological thinning with configurable iteration count.
 *
 * Uses the same topology-preserving LUT as Lee's method but with a maximum
 * iteration limit. Lower maxIterations produces thicker skeletons that preserve
 * more of the original stroke width.
 *
 * With maxIterations = Infinity this is equivalent to full Lee thinning.
 */
export function morphologicalThin(bitmap: Uint8Array, width: number, height: number, maxIterations: number): Uint8Array {
  const result = new Uint8Array(bitmap);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    for (const dir of BORDER_DIRS) {
      const toDelete: number[] = [];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (result[idx] === 0) continue;

          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && result[ny * width + nx] !== 0) continue;

          const neighbors = encodeNeighborhood(x, y, result, width, height);
          if (REMOVAL_LUT[neighbors]) {
            toDelete.push(idx);
          }
        }
      }

      for (const idx of toDelete) {
        result[idx] = 0;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return result;
}

/**
 * Zhang-Suen thinning algorithm.
 * Reduces binary shapes to 1-pixel-wide skeletons while preserving topology.
 */
export function zhangSuenThin(bitmap: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(bitmap);

  const get = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return result[y * width + x]!;
  };

  let changed = true;
  while (changed) {
    changed = false;

    // Sub-iteration 1
    const toDelete1: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (result[y * width + x] === 0) continue;

        const p2 = get(x, y - 1);
        const p3 = get(x + 1, y - 1);
        const p4 = get(x + 1, y);
        const p5 = get(x + 1, y + 1);
        const p6 = get(x, y + 1);
        const p7 = get(x - 1, y + 1);
        const p8 = get(x - 1, y);
        const p9 = get(x - 1, y - 1);

        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;

        const seq = [p2, p3, p4, p5, p6, p7, p8, p9];
        let A = 0;
        for (let i = 0; i < 8; i++) {
          if (seq[i] === 0 && seq[(i + 1) % 8] === 1) A++;
        }
        if (A !== 1) continue;

        if (p2 * p4 * p6 !== 0) continue;
        if (p4 * p6 * p8 !== 0) continue;

        toDelete1.push(y * width + x);
      }
    }
    for (const idx of toDelete1) {
      result[idx] = 0;
      changed = true;
    }

    // Sub-iteration 2
    const toDelete2: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (result[y * width + x] === 0) continue;

        const p2 = get(x, y - 1);
        const p3 = get(x + 1, y - 1);
        const p4 = get(x + 1, y);
        const p5 = get(x + 1, y + 1);
        const p6 = get(x, y + 1);
        const p7 = get(x - 1, y + 1);
        const p8 = get(x - 1, y);
        const p9 = get(x - 1, y - 1);

        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;

        const seq = [p2, p3, p4, p5, p6, p7, p8, p9];
        let A = 0;
        for (let i = 0; i < 8; i++) {
          if (seq[i] === 0 && seq[(i + 1) % 8] === 1) A++;
        }
        if (A !== 1) continue;

        if (p2 * p4 * p8 !== 0) continue;
        if (p2 * p6 * p8 !== 0) continue;

        toDelete2.push(y * width + x);
      }
    }
    for (const idx of toDelete2) {
      result[idx] = 0;
      changed = true;
    }
  }

  return result;
}
