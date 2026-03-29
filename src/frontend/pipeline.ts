import opentype from 'opentype.js';
import type { SkeletonMethod } from '../constants.ts';
import { extractGlyph, inferLineCap } from '../font/parse.ts';
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
import type { BBox, LineCap, Point, Stroke } from '../types.ts';

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

/** Run the full processing pipeline for a single glyph in the browser */
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
