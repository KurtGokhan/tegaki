// Script-direction detection for stroke-ordering.
// Arabic / Hebrew / Syriac / Thaana / N'Ko glyphs are naturally handwritten
// right-to-left, so the stroke tracer should start from the right side of the
// glyph and per-stroke orientation should prefer a right-to-left sweep. See
// `traceAndSimplify` and `orientPolyline` for how this flag is applied.

export function isRtlCodepoint(cp: number): boolean {
  // Hebrew
  if (cp >= 0x0590 && cp <= 0x05ff) return true;
  // Arabic, Arabic Supplement, Arabic Extended-A/B, Syriac, Thaana, N'Ko
  if (cp >= 0x0600 && cp <= 0x08ff) return true;
  // Arabic Presentation Forms-A
  if (cp >= 0xfb50 && cp <= 0xfdff) return true;
  // Arabic Presentation Forms-B
  if (cp >= 0xfe70 && cp <= 0xfeff) return true;
  return false;
}

export function isRtlChar(char: string): boolean {
  if (!char) return false;
  const cp = char.codePointAt(0);
  return cp != null && isRtlCodepoint(cp);
}
