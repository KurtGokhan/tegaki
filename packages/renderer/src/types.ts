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

export interface TegakiGlyphData {
  advanceWidth: number;
  strokes: {
    points: { x: number; y: number; t: number; width: number }[];
    delay: number;
    animationDuration: number;
  }[];
}

export type TegakiEffectConfigs = {
  glow: { radius?: number; color?: string };
  wobble: { amplitude?: number; frequency?: number };
  pressureWidth: {};
  rainbow: { saturation?: number; lightness?: number };
};

export type TegakiEffectName = keyof TegakiEffectConfigs;

type TegakiCustomEffect = {
  [K in TegakiEffectName]: TegakiEffectConfigs[K] & { effect: K; order?: number };
}[TegakiEffectName];

/** Validates an effects object: known keys infer `effect`, unknown keys require it. */
export type TegakiEffects<T> = {
  [K in keyof T]: K extends TegakiEffectName
    ? (TegakiEffectConfigs[K] & { effect?: K; order?: number }) | boolean
    : TegakiCustomEffect | boolean;
};

export interface TegakiBundle {
  family: string;
  lineCap: LineCap;
  fontUrl: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  glyphs: Record<string, import('react').FC<import('react').SVGProps<SVGSVGElement>>>;
  glyphData?: Record<string, TegakiGlyphData>;
  glyphTimings: Record<string, number>;
  registerFontFace: () => Promise<void>;
}
