/**
 * Current bundle format version. Incremented when the bundle format changes
 * in a way that older engines cannot consume.
 */
export const BUNDLE_VERSION = 0;

/**
 * Set of bundle versions that this engine can consume. The engine logs a
 * console warning (once per bundle) when it encounters a version outside
 * this set.
 */
export const COMPATIBLE_BUNDLE_VERSIONS: ReadonlySet<number> = new Set([BUNDLE_VERSION]);

export type LineCap = 'round' | 'butt' | 'square';

export interface Point {
  x: number;
  y: number;
}

export interface TimedPoint extends Point {
  t: number;
  width: number;
}

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Stroke {
  points: TimedPoint[];
  order: number;
  length: number;
  animationDuration: number;
  delay: number;
}

export interface GlyphData {
  char: string;
  unicode: number;
  advanceWidth: number;
  boundingBox: BBox;
  path: string;
  skeleton: Point[][];
  strokes: Stroke[];
  totalLength: number;
  totalAnimationDuration: number;
}

export interface FontOutput {
  font: {
    family: string;
    style: string;
    unitsPerEm: number;
    ascender: number;
    descender: number;
    lineCap: LineCap;
  };
  glyphs: Record<string, GlyphData>;
}

export interface PathCommand {
  type: 'M' | 'L' | 'Q' | 'C' | 'Z';
  x: number;
  y: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

/**
 * Compact glyph data for rendering.
 * - `w`: advance width
 * - `t`: total animation duration
 * - `s`: strokes, each with `p` (points as `[x, y, width]` tuples), `d` (delay), `a` (animation duration)
 */
export interface TegakiGlyphData {
  w: number;
  t: number;
  s: {
    p: ([x: number, y: number, width: number] | number[])[];
    d: number;
    a: number;
  }[];
}

type BaseEffectConfig = { enabled?: boolean };

/** A length value: plain number is pixels, string `"${number}em"` is relative to font size. */
export type CSSLength = number | `${number}em`;

export type TegakiEffectConfigs = {
  glow: BaseEffectConfig & { radius?: CSSLength; color?: string; offsetX?: number; offsetY?: number };
  wobble: BaseEffectConfig & { amplitude?: number; frequency?: number; mode?: 'sine' | 'noise' };
  pressureWidth: BaseEffectConfig & { strength?: number };
  taper: BaseEffectConfig & { startLength?: number; endLength?: number };
  strokeGradient: BaseEffectConfig & { colors?: string[] | 'rainbow'; saturation?: number; lightness?: number };
};

export type TegakiEffectName = keyof TegakiEffectConfigs;

/** Effects that can only appear once (cannot be used with custom keys). */
export type TegakiSingletonEffectName = 'pressureWidth' | 'wobble' | 'taper' | 'strokeGradient';

/** Effects that can be duplicated with custom keys. */
export type TegakiMultiEffectName = Exclude<TegakiEffectName, TegakiSingletonEffectName>;

type TegakiCustomEffect = {
  [K in TegakiMultiEffectName]: TegakiEffectConfigs[K] & { effect: K; order?: number };
}[TegakiMultiEffectName];

/** Validates an effects object: known keys infer `effect`, unknown keys require it (singleton effects excluded). */
export type TegakiEffects<T> = {
  [K in keyof T]: K extends TegakiEffectName
    ? (TegakiEffectConfigs[K] & { effect?: K; order?: number }) | boolean
    : TegakiCustomEffect | boolean;
};

export interface TegakiBundle {
  /** Bundle format version. Used by the engine to warn about incompatible bundles. */
  version?: number;
  family: string;
  /**
   * Original font family name, used as a CSS fallback for characters not in
   * the generated glyph set. Present when the bundle was generated from a
   * subset of the font (the default). When absent, `family` is the original
   * name (full-font bundle).
   */
  fullFamily?: string;
  lineCap: LineCap;
  fontUrl: string;
  /** URL to the full (non-subsetted) font file bundled for fallback rendering. */
  fullFontUrl?: string;
  fontFaceCSS: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  glyphData: Record<string, TegakiGlyphData>;
}
