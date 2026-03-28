/**
 * Compute stroke width at each skeleton point using distance transform.
 * For each skeleton pixel, the width is 2x the distance to the nearest background pixel.
 */
export function computeDistanceTransform(bitmap: Uint8Array, width: number, height: number): Float32Array {
  const dist = new Float32Array(width * height);
  const INF = width + height;

  // Initialize: foreground = 0, background = INF
  for (let i = 0; i < bitmap.length; i++) {
    dist[i] = bitmap[i] ? 0 : INF;
  }

  // Forward pass (top-left to bottom-right)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (dist[idx] === 0) continue; // background pixel

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
 * Invert the distance transform: compute distance from foreground to nearest background.
 * This gives the "radius" at each point inside the shape.
 */
export function computeInverseDistanceTransform(bitmap: Uint8Array, width: number, height: number): Float32Array {
  // Invert the bitmap: foreground becomes background and vice versa
  const inverted = new Uint8Array(bitmap.length);
  for (let i = 0; i < bitmap.length; i++) {
    inverted[i] = bitmap[i] ? 0 : 1;
  }
  return computeDistanceTransform(inverted, width, height);
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
