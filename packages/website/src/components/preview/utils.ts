/** Scale (w, h) to fit within maxSize while preserving aspect ratio */
export function fitSize(w: number, h: number, maxSize: number): { width: number; height: number } {
  const scale = Math.min(maxSize / w, maxSize / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
