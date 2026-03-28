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

        // A: number of 0->1 transitions in the ordered sequence p2,p3,...,p9,p2
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9];
        let A = 0;
        for (let i = 0; i < 8; i++) {
          if (seq[i] === 0 && seq[(i + 1) % 8] === 1) A++;
        }
        if (A !== 1) continue;

        if (p2 * p4 * p6 !== 0) continue; // condition 4
        if (p4 * p6 * p8 !== 0) continue; // condition 5

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

        if (p2 * p4 * p8 !== 0) continue; // condition 4 (different)
        if (p2 * p6 * p8 !== 0) continue; // condition 5 (different)

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
