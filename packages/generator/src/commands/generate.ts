import opentype from 'opentype.js';
import type { BBox, FontOutput, LineCap, Point, Stroke } from 'tegaki';
import * as z from 'zod/v4';
import {
  DEFAULT_CHARS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_RESOLUTION,
  DRAWING_SPEED,
  SKELETON_METHOD,
  type SkeletonMethod,
  STROKE_PAUSE,
} from '../constants.ts';
import { extractGlyph, inferLineCap } from '../font/parse.ts';
import { charToFilename, glyphToAnimatedSVG } from '../processing/animated-svg.ts';
import { flattenPath } from '../processing/bezier.ts';
import { rasterize } from '../processing/rasterize.ts';
import {
  cleanJunctionClusters,
  guoHallThin,
  leeThin,
  medialAxisThin,
  morphologicalThin,
  restoreErasedComponents,
  type ThinFn,
  zhangSuenThin,
} from '../processing/skeletonize.ts';
import { orderStrokes } from '../processing/stroke-order.ts';
import { traceAndSimplify } from '../processing/trace.ts';
import { voronoiMedialAxis } from '../processing/voronoi-medial-axis.ts';
import { computeInverseDistanceTransform } from '../processing/width.ts';

// ── Pipeline types & defaults ──────────────────────────────────────────────

/** Browser-compatible skeleton methods (excludes scikit-image variants) */
export type BrowserSkeletonMethod = Exclude<SkeletonMethod, `skimage-${string}`>;

export interface PipelineOptions {
  resolution: number;
  skeletonMethod: BrowserSkeletonMethod;
  lineCap: LineCap | 'auto';
  bezierTolerance: number;
  rdpTolerance: number;
  spurLengthRatio: number;
  mergeThresholdRatio: number;
  traceLookback: number;
  curvatureBias: number;
  thinMaxIterations: number;
  junctionCleanupIterations: number;
  dtMethod: 'euclidean' | 'chamfer';
  voronoiSamplingInterval: number;
  drawingSpeed: number;
  strokePause: number;
}

export const DEFAULT_OPTIONS: PipelineOptions = {
  resolution: 400,
  skeletonMethod: 'zhang-suen',
  lineCap: 'auto',
  bezierTolerance: 0.5,
  rdpTolerance: 1.5,
  spurLengthRatio: 0.08,
  mergeThresholdRatio: 0.08,
  traceLookback: 12,
  curvatureBias: 0.5,
  thinMaxIterations: 25,
  junctionCleanupIterations: 5,
  dtMethod: 'chamfer',
  voronoiSamplingInterval: 2,
  drawingSpeed: 3000,
  strokePause: 0.15,
};

export interface PipelineResult {
  char: string;
  unicode: number;
  advanceWidth: number;
  boundingBox: BBox;
  pathString: string;
  lineCap: LineCap;
  ascender: number;
  descender: number;

  // Stage 1: Flattened paths
  subPaths: Point[][];
  pathBBox: BBox;

  // Stage 2: Rasterized bitmap
  bitmap: Uint8Array;
  bitmapWidth: number;
  bitmapHeight: number;
  transform: { scaleX: number; scaleY: number; offsetX: number; offsetY: number };

  // Stage 3: Skeleton
  skeleton: Uint8Array;

  // Stage 4: Inverse distance transform
  inverseDT: Float32Array;

  // Stage 5: Traced polylines
  polylines: Point[][];

  // Stage 6: Ordered strokes (in bitmap space)
  strokes: Stroke[];

  // Stage 7: Font-unit strokes (final output)
  strokesFontUnits: (Stroke & { animationDuration: number; delay: number; length: number })[];
}

export interface ParsedFontInfo {
  family: string;
  style: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineCap: LineCap;
  font: opentype.Font;
}

// ── Bundle types ──────────────────────────────────────────────────────────

export interface BundleFile {
  /** Relative path within the bundle (e.g., "font.json", "svg/A.svg") */
  path: string;
  /** File content — string for text files, Uint8Array for binary */
  content: string | Uint8Array;
}

export interface ExtractBundleInput {
  fontBuffer: ArrayBuffer;
  fontFileName: string;
  chars: string;
  options: PipelineOptions;
  onProgress?: (message: string, progress?: number) => void;
}

export interface TegakiBundleOutput {
  fontOutput: FontOutput;
  glyphResults: Record<string, PipelineResult>;
  files: BundleFile[];
  stats: { processed: number; skipped: number };
}

// ── SVG → TSX conversion ──────────────────────────────────────────────────

const SVG_ATTR_MAP: Record<string, string> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'font-size': 'fontSize',
  'font-family': 'fontFamily',
};

/** Convert an SVG string to a TSX React component (browser-compatible, no SVGR needed) */
export function svgToTsx(svg: string): string {
  let jsx = svg;
  for (const [attr, jsxAttr] of Object.entries(SVG_ATTR_MAP)) {
    jsx = jsx.replaceAll(` ${attr}=`, ` ${jsxAttr}=`);
  }
  jsx = jsx.replace(/<svg\s/, '<svg {...props} ');

  return `import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (${jsx});
export default SvgComponent;
`;
}

// ── Pipeline functions ─────────────────────────────────────────────────────

/** Parse a font from an ArrayBuffer (browser-compatible) */
export function parseFont(buffer: ArrayBuffer): ParsedFontInfo {
  const font = opentype.parse(buffer);
  return {
    family: font.names.fontFamily?.en ?? 'Unknown',
    style: font.names.fontSubfamily?.en ?? 'Regular',
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: font.descender,
    lineCap: inferLineCap(font),
    font,
  };
}

function computePathBBox(subPaths: Point[][]): BBox {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const path of subPaths) {
    for (const p of path) {
      if (p.x < x1) x1 = p.x;
      if (p.y < y1) y1 = p.y;
      if (p.x > x2) x2 = p.x;
      if (p.y > y2) y2 = p.y;
    }
  }
  return { x1, y1, x2, y2 };
}

/** Run the full processing pipeline for a single glyph */
export function processGlyph(fontInfo: ParsedFontInfo, char: string, options: PipelineOptions): PipelineResult | null {
  const rawGlyph = extractGlyph(fontInfo.font, char);
  if (!rawGlyph) return null;

  const lineCap: LineCap = options.lineCap === 'auto' ? fontInfo.lineCap : options.lineCap;

  // Stage 1: Flatten bezier curves
  const subPaths = flattenPath(rawGlyph.commands, options.bezierTolerance);
  const pathBBox = computePathBBox(subPaths);

  // Stage 2: Rasterize
  const raster = rasterize(subPaths, pathBBox, options.resolution);

  // Stage 3 & 4: Skeletonize + distance transform
  let polylines: Point[][];
  let skeleton: Uint8Array;
  let voronoiWidths: number[][] | undefined;

  const inverseDT = computeInverseDistanceTransform(raster.bitmap, raster.width, raster.height, options.dtMethod);

  if (options.skeletonMethod === 'voronoi') {
    const vResult = voronoiMedialAxis(subPaths, pathBBox, raster.transform, raster.width, raster.height, options.voronoiSamplingInterval);
    polylines = vResult.polylines;
    voronoiWidths = vResult.widths;
    // For voronoi, create a skeleton bitmap from polylines for visualization
    skeleton = new Uint8Array(raster.width * raster.height);
    for (const pl of polylines) {
      for (const p of pl) {
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        if (px >= 0 && px < raster.width && py >= 0 && py < raster.height) {
          skeleton[py * raster.width + px] = 1;
        }
      }
    }
  } else {
    // TypeScript thinning
    const thinFns: Record<string, ThinFn> = {
      'zhang-suen': zhangSuenThin,
      'guo-hall': guoHallThin,
      lee: leeThin,
      thin: (bmp, w, h) => morphologicalThin(bmp, w, h, options.thinMaxIterations),
    };
    const thinFn = thinFns[options.skeletonMethod] ?? zhangSuenThin;

    if (options.skeletonMethod === 'medial-axis') {
      skeleton = medialAxisThin(raster.bitmap, inverseDT, raster.width, raster.height);
    } else {
      const raw = thinFn(raster.bitmap, raster.width, raster.height);
      skeleton = cleanJunctionClusters(raw, inverseDT, raster.width, raster.height, thinFn, options.junctionCleanupIterations);
    }

    restoreErasedComponents(raster.bitmap, skeleton, inverseDT, raster.width, raster.height);

    // Stage 5: Trace
    const spurMinLength = Math.min(Math.round(Math.max(raster.width, raster.height) * options.spurLengthRatio), 10);
    polylines = traceAndSimplify(
      skeleton,
      raster.width,
      raster.height,
      options.rdpTolerance,
      spurMinLength,
      options.traceLookback,
      options.curvatureBias,
    );
  }

  // Stage 6: Order strokes
  const strokes = orderStrokes(polylines, inverseDT, raster.width, 3, voronoiWidths);

  // Stage 7: Convert to font units
  const scale = raster.transform.scaleX;
  let timeOffset = 0;
  const strokesFontUnits = strokes.map((s, i) => {
    const length = Math.round((s.length / scale) * 100) / 100;
    const animationDuration = Math.max(Math.round((length / options.drawingSpeed) * 1000) / 1000, 0.001);
    const delay = Math.round(timeOffset * 1000) / 1000;
    timeOffset += animationDuration + (i < strokes.length - 1 ? options.strokePause : 0);
    return {
      ...s,
      length,
      animationDuration,
      delay,
      points: s.points.map((p) => ({
        x: Math.round((p.x / raster.transform.scaleX + raster.transform.offsetX) * 100) / 100,
        y: Math.round((p.y / raster.transform.scaleY + raster.transform.offsetY) * 100) / 100,
        t: Math.round(p.t * 1000) / 1000,
        width: Math.round((p.width / scale) * 100) / 100,
      })),
    };
  });

  return {
    char,
    unicode: rawGlyph.unicode,
    advanceWidth: rawGlyph.advanceWidth,
    boundingBox: rawGlyph.boundingBox,
    pathString: rawGlyph.pathString,
    lineCap,
    ascender: fontInfo.ascender,
    descender: fontInfo.descender,
    subPaths,
    pathBBox,
    bitmap: raster.bitmap,
    bitmapWidth: raster.width,
    bitmapHeight: raster.height,
    transform: raster.transform,
    skeleton,
    inverseDT,
    polylines,
    strokes,
    strokesFontUnits,
  };
}

// ── CLI argument schema ───────────────────────────────────────────────────

export const generateArgsSchema = z.object({
  family: z.string().default(DEFAULT_FONT_FAMILY).describe('Google Fonts family name'),
  output: z.string().optional().describe('Output folder path for the font bundle').meta({ flags: 'o' }),
  resolution: z.number().default(DEFAULT_RESOLUTION).describe('Bitmap resolution for skeletonization').meta({ flags: 'r' }),
  chars: z.string().default(DEFAULT_CHARS).describe('Characters to process').meta({ flags: 'c' }),
  force: z.boolean().default(false).describe('Re-download font even if cached').meta({ flags: 'f' }),
  debug: z.boolean().default(false).describe('Output intermediate steps (bitmap, skeleton, trace, animation SVGs)').meta({ flags: 'd' }),
  lineCap: z
    .enum(['auto', 'round', 'butt', 'square'])
    .default('auto')
    .describe('Stroke line cap style (auto infers from font properties)')
    .meta({ flags: 'l' }),
  skeletonMethod: z
    .enum(['zhang-suen', 'guo-hall', 'medial-axis', 'lee', 'thin', 'voronoi'])
    .default(SKELETON_METHOD as BrowserSkeletonMethod)
    .describe('Skeletonization algorithm'),
  bezierTolerance: z.number().default(DEFAULT_OPTIONS.bezierTolerance).describe('Bezier curve flattening tolerance'),
  rdpTolerance: z.number().default(DEFAULT_OPTIONS.rdpTolerance).describe('Ramer-Douglas-Peucker simplification tolerance'),
  spurLengthRatio: z.number().default(DEFAULT_OPTIONS.spurLengthRatio).describe('Minimum spur length as fraction of bitmap size'),
  mergeThresholdRatio: z.number().default(DEFAULT_OPTIONS.mergeThresholdRatio).describe('Merge threshold as fraction of bitmap size'),
  traceLookback: z.number().default(DEFAULT_OPTIONS.traceLookback).describe('Lookback window for junction direction estimation'),
  curvatureBias: z.number().default(DEFAULT_OPTIONS.curvatureBias).describe('Curvature extrapolation weight at junctions'),
  thinMaxIterations: z.number().default(DEFAULT_OPTIONS.thinMaxIterations).describe('Max iterations for morphological thinning'),
  junctionCleanupIterations: z
    .number()
    .default(DEFAULT_OPTIONS.junctionCleanupIterations)
    .describe('Max iterations for junction cluster cleanup'),
  dtMethod: z.enum(['euclidean', 'chamfer']).default(DEFAULT_OPTIONS.dtMethod).describe('Distance transform algorithm'),
  voronoiSamplingInterval: z.number().default(DEFAULT_OPTIONS.voronoiSamplingInterval).describe('Voronoi boundary sampling interval'),
  drawingSpeed: z.number().default(DRAWING_SPEED).describe('Drawing speed in font units per second'),
  strokePause: z.number().default(STROKE_PAUSE).describe('Pause duration in seconds between strokes'),
});

// ── Bundle extraction (pure — no file I/O) ────────────────────────────────

export function extractTegakiBundle(input: ExtractBundleInput): TegakiBundleOutput {
  const { fontBuffer, fontFileName, chars: charsStr, options, onProgress } = input;
  const fontInfo = parseFont(fontBuffer);

  const lineCap: LineCap = options.lineCap === 'auto' ? fontInfo.lineCap : options.lineCap;

  onProgress?.(`Processing ${fontInfo.family} ${fontInfo.style} (${fontInfo.unitsPerEm} units/em, ${lineCap} caps)`, 0);

  const output: FontOutput = {
    font: {
      family: fontInfo.family,
      style: fontInfo.style,
      unitsPerEm: fontInfo.unitsPerEm,
      ascender: fontInfo.ascender,
      descender: fontInfo.descender,
      lineCap,
    },
    glyphs: {},
  };

  const chars = [...charsStr];
  let processed = 0;
  let skipped = 0;
  const glyphResults: Record<string, PipelineResult> = {};

  for (const char of chars) {
    const result = processGlyph(fontInfo, char, options);
    if (!result) {
      skipped++;
      continue;
    }

    glyphResults[char] = result;

    const { strokesFontUnits, polylines, transform } = result;
    const skeletonFontUnits = polylines.map((pl) =>
      pl.map((p) => ({
        x: Math.round((p.x / transform.scaleX + transform.offsetX) * 100) / 100,
        y: Math.round((p.y / transform.scaleY + transform.offsetY) * 100) / 100,
      })),
    );

    const totalLength = Math.round(strokesFontUnits.reduce((sum, s) => sum + s.length, 0) * 100) / 100;
    const last = strokesFontUnits[strokesFontUnits.length - 1];
    const totalAnimationDuration = last ? Math.round((last.delay + last.animationDuration) * 1000) / 1000 : 0;

    output.glyphs[char] = {
      char: result.char,
      unicode: result.unicode,
      advanceWidth: result.advanceWidth,
      boundingBox: result.boundingBox,
      path: result.pathString,
      skeleton: skeletonFontUnits,
      strokes: strokesFontUnits,
      totalLength,
      totalAnimationDuration,
    };

    processed++;
    onProgress?.(`Processing glyph "${char}"`, processed / chars.length);
  }

  // Build bundle files
  const files: BundleFile[] = [];

  files.push({ path: 'font.json', content: JSON.stringify(output, null, 2) });
  files.push({ path: fontFileName, content: new Uint8Array(fontBuffer) });

  const glyphEntries: { char: string; basename: string; totalAnimationDuration: number }[] = [];
  for (const glyph of Object.values(output.glyphs)) {
    const base = charToFilename(glyph.char);
    const svg = glyphToAnimatedSVG(glyph.strokes, glyph.advanceWidth, fontInfo.ascender, fontInfo.descender, lineCap);
    files.push({ path: `svg/${base}.svg`, content: svg });
    files.push({ path: `svg/${base}.tsx`, content: svgToTsx(svg) });
    glyphEntries.push({ char: glyph.char, basename: base, totalAnimationDuration: glyph.totalAnimationDuration });
  }

  files.push({
    path: 'bundle.ts',
    content: generateGlyphsModule(
      glyphEntries,
      fontFileName,
      fontInfo.family,
      lineCap,
      fontInfo.unitsPerEm,
      fontInfo.ascender,
      fontInfo.descender,
    ),
  });

  return { fontOutput: output, glyphResults, files, stats: { processed, skipped } };
}

function generateGlyphsModule(
  entries: { char: string; basename: string; totalAnimationDuration: number }[],
  fontFileName: string,
  fontFamily: string,
  lineCap: LineCap,
  unitsPerEm: number,
  ascender: number,
  descender: number,
): string {
  const imports: string[] = [];
  const mapEntries: string[] = [];
  const timingEntries: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { char, basename: base, totalAnimationDuration } = entries[i]!;
    const varName = `_${i}`;
    imports.push(`import ${varName} from './svg/${base}.tsx';`);

    const escaped = char === '\\' ? '\\\\' : char === "'" ? "\\'" : char;
    mapEntries.push(`  '${escaped}': ${varName},`);
    timingEntries.push(`  '${escaped}': ${totalAnimationDuration},`);
  }

  return `// Auto-generated by Tegaki. Do not edit manually.
import fontUrl from './${fontFileName}' with { type: 'url' };

${imports.join('\n')}

let registered: Promise<void> | null = null;

const bundle = {
  family: '${fontFamily.replace(/'/g, "\\'")}',
  lineCap: '${lineCap}',
  fontUrl,
  unitsPerEm: ${unitsPerEm},
  ascender: ${ascender},
  descender: ${descender},
  glyphs: {
${mapEntries.join('\n')}
  },
  glyphTimings: {
${timingEntries.join('\n')}
  },
  registerFontFace() {
    if (!registered) {
      registered = new FontFace(bundle.family, \`url(\${fontUrl})\`)
        .load()
        .then((loaded) => { document.fonts.add(loaded); });
    }
    return registered;
  },
} as const;

export default bundle;
`;
}
