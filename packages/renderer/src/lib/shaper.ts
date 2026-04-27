export interface ShapedGlyph {
  /**
   * Shaper output key — the opentype glyph id for primary-subset glyphs (e.g.
   * `"42"`), or `"<subsetIndex>:<gid>"` for glyphs from an `extraFontUrls`
   * subset (e.g. `"1:42"`). Used directly to look up `glyphDataById`.
   */
  g: string;
  /** Cluster offset (utf16 code-unit index into the shaped substring). */
  cl: number;
  /** X advance in font units. */
  ax: number;
  /** Y advance in font units. */
  ay: number;
  /** X offset (displacement from pen position) in font units. */
  dx: number;
  /** Y offset (displacement from pen position) in font units. */
  dy: number;
}

export interface BundleShaper {
  shape(text: string): ShapedGlyph[];
}
