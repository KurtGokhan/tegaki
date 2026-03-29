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
  };
  glyphs: Record<string, GlyphData>;
}

export interface FontBundle {
  family: string;
  fontUrl: string;
  glyphs: Record<string, import('react').FC<import('react').SVGProps<SVGSVGElement>>>;
  glyphTimings: Record<string, number>;
  registerFontFace: () => Promise<void>;
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
