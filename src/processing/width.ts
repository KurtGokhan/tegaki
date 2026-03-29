import { DISTANCE_TRANSFORM_METHOD } from '../constants.ts';

/**
 * Compute distance transform using the configured method.
 */
export function computeDistanceTransform(
  bitmap: Uint8Array,
  width: number,
  height: number,
  method?: 'euclidean' | 'chamfer',
): Float32Array {
  if ((method ?? DISTANCE_TRANSFORM_METHOD) === 'chamfer') {
    return computeChamferDT(bitmap, width, height);
  }
  return computeEuclideanDT(bitmap, width, height);
}

/**
 * Chamfer distance transform (2-pass, sqrt(2) diagonal cost).
 * Fast approximation that produces smooth gradients.
 */
function computeChamferDT(bitmap: Uint8Array, width: number, height: number): Float32Array {
  const dist = new Float32Array(width * height);
  const INF = width + height;

  for (let i = 0; i < bitmap.length; i++) {
    dist[i] = bitmap[i] ? 0 : INF;
  }

  // Forward pass (top-left to bottom-right)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (dist[idx] === 0) continue;
      if (y > 0) dist[idx] = Math.min(dist[idx]!, dist[(y - 1) * width + x]! + 1);
      if (x > 0) dist[idx] = Math.min(dist[idx]!, dist[y * width + (x - 1)]! + 1);
      if (y > 0 && x > 0) dist[idx] = Math.min(dist[idx]!, dist[(y - 1) * width + (x - 1)]! + Math.SQRT2);
      if (y > 0 && x < width - 1) dist[idx] = Math.min(dist[idx]!, dist[(y - 1) * width + (x + 1)]! + Math.SQRT2);
    }
  }

  // Backward pass (bottom-right to top-left)
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      if (dist[idx] === 0) continue;
      if (y < height - 1) dist[idx] = Math.min(dist[idx]!, dist[(y + 1) * width + x]! + 1);
      if (x < width - 1) dist[idx] = Math.min(dist[idx]!, dist[y * width + (x + 1)]! + 1);
      if (y < height - 1 && x < width - 1) dist[idx] = Math.min(dist[idx]!, dist[(y + 1) * width + (x + 1)]! + Math.SQRT2);
      if (y < height - 1 && x > 0) dist[idx] = Math.min(dist[idx]!, dist[(y + 1) * width + (x - 1)]! + Math.SQRT2);
    }
  }

  return dist;
}

/**
 * Exact Euclidean distance transform using Felzenszwalb & Huttenlocher's algorithm.
 * Returns actual (non-squared) Euclidean distances.
 */
function computeEuclideanDT(bitmap: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e20;
  const size = width * height;

  // Squared distance grid: 0 for foreground (seed), INF for background (to be computed)
  const d = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    d[i] = bitmap[i] ? 0 : INF;
  }

  // 1D EDT along columns (vertical)
  const maxDim = Math.max(width, height);
  const v = new Int32Array(maxDim); // locations of parabolas
  const z = new Float32Array(maxDim + 1); // boundaries between parabolas
  const f = new Float32Array(maxDim); // 1D input
  const out = new Float32Array(maxDim); // 1D output

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = d[y * width + x]!;
    edt1d(f, out, height, v, z);
    for (let y = 0; y < height; y++) d[y * width + x] = out[y]!;
  }

  // 1D EDT along rows (horizontal)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = d[y * width + x]!;
    edt1d(f, out, width, v, z);
    for (let x = 0; x < width; x++) d[y * width + x] = out[x]!;
  }

  // Convert squared distances to actual distances
  for (let i = 0; i < size; i++) {
    d[i] = Math.sqrt(d[i]!);
  }

  return d;
}

/**
 * 1D squared Euclidean distance transform.
 * Uses lower envelope of parabolas algorithm.
 * Reads from `f`, writes result into `out`.
 */
function edt1d(f: Float32Array, out: Float32Array, n: number, v: Int32Array, z: Float32Array): void {
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  let k = 0;

  for (let q = 1; q < n; q++) {
    let s: number;
    while (true) {
      const vk = v[k]!;
      s = (f[q]! + q * q - (f[vk]! + vk * vk)) / (2 * q - 2 * vk);
      if (s > z[k]!) break;
      k--;
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }

  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const vk = v[k]!;
    const dq = q - vk;
    out[q] = dq * dq + f[vk]!;
  }
}

/**
 * Invert the distance transform: compute distance from foreground to nearest background.
 * This gives the "radius" at each point inside the shape.
 */
export function computeInverseDistanceTransform(
  bitmap: Uint8Array,
  width: number,
  height: number,
  method?: 'euclidean' | 'chamfer',
): Float32Array {
  // Invert the bitmap: foreground becomes background and vice versa
  const inverted = new Uint8Array(bitmap.length);
  for (let i = 0; i < bitmap.length; i++) {
    inverted[i] = bitmap[i] ? 0 : 1;
  }
  return computeDistanceTransform(inverted, width, height, method);
}

/**
 * Get stroke width (diameter) at a skeleton pixel position.
 * Uses the original (pre-thinning) bitmap's inverse distance transform.
 */
export function getStrokeWidth(x: number, y: number, inverseDT: Float32Array, width: number): number {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const idx = ry * width + rx;
  const radius = inverseDT[idx] ?? 0;
  return radius * 2;
}
