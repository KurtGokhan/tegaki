import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RasterResult } from '../processing/rasterize.ts';
import type { LineCap, Point, Stroke } from '../types.ts';
import { bitmapToPNG } from './png.ts';

const STROKE_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990'];

/** Render a single-point dot as a circle (round cap) or rect (butt/square cap). */
function dotElement(x: string, y: string, size: number, fill: string, lineCap: LineCap): string {
  if (lineCap === 'round') {
    return `<circle cx="${x}" cy="${y}" r="${(size / 2).toFixed(1)}" fill="${fill}"`;
  }
  const half = size / 2;
  return `<rect x="${(Number(x) - half).toFixed(1)}" y="${(Number(y) - half).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${fill}"`;
}

export function charToFilename(char: string): string {
  const code = char.codePointAt(0)!;
  // Use readable names for alphanumeric, hex code for symbols
  if (/[a-zA-Z0-9]/.test(char)) {
    return char.charCodeAt(0) >= 65 && char.charCodeAt(0) <= 90 ? `upper_${char}` : char;
  }
  return `U+${code.toString(16).padStart(4, '0')}`;
}

function polylinesToSVG(
  polylines: Point[][],
  width: number,
  height: number,
  title: string,
  strokeWidth = 1,
  lineCap: LineCap = 'round',
): string {
  const paths = polylines
    .map((pl, i) => {
      const color = STROKE_COLORS[i % STROKE_COLORS.length]!;
      if (pl.length === 1) {
        const p = pl[0]!;
        return `  ${dotElement(p.x.toFixed(1), p.y.toFixed(1), strokeWidth, color, lineCap)}/>`;
      }
      const d = pl.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return `  <path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${lineCap}" stroke-linejoin="round"/>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 2}" height="${height * 2}">
  <title>${title}</title>
  <rect width="${width}" height="${height}" fill="white"/>
${paths}
</svg>`;
}

function strokesAnimationSVG(strokes: Stroke[], width: number, height: number, title: string, lineCap: LineCap = 'round'): string {
  const drawingDuration = 2; // total seconds spent drawing (excluding pauses)
  const pauseBetween = 0.15; // seconds pause between strokes

  // Compute total length across all strokes for proportional timing
  const totalLength = strokes.reduce((sum, s) => sum + s.length, 0);

  const elements: string[] = [];
  let timeOffset = 0;

  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i]!;
    const color = STROKE_COLORS[i % STROKE_COLORS.length];
    const d = stroke.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // Compute SVG path length for dash animation
    let len = 0;
    for (let j = 1; j < stroke.points.length; j++) {
      const dx = stroke.points[j]!.x - stroke.points[j - 1]!.x;
      const dy = stroke.points[j]!.y - stroke.points[j - 1]!.y;
      len += Math.sqrt(dx * dx + dy * dy);
    }

    const avgWidth = stroke.points.reduce((s, p) => s + p.width, 0) / stroke.points.length;
    const strokeDuration = totalLength > 0 ? Math.max((stroke.length / totalLength) * drawingDuration, 0.05) : 0.1;
    const begin = `${timeOffset.toFixed(3)}s`;

    if (len === 0) {
      // Single-point stroke (dot): render as a shape that fades in
      const p = stroke.points[0]!;
      const size = Math.max(avgWidth, 1);
      elements.push(`  ${dotElement(p.x.toFixed(1), p.y.toFixed(1), size, color!, lineCap)} opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="${strokeDuration.toFixed(3)}s" begin="${begin}" fill="freeze"/>
  </${lineCap === 'round' ? 'circle' : 'rect'}>`);
    } else {
      // Stroke path: starts hidden, becomes visible and animates when its turn begins
      // opacity:0 is needed because round linecaps bleed past the dashoffset on thick strokes
      elements.push(`  <path d="${d}" fill="none" stroke="${color}" stroke-width="${Math.max(avgWidth, 1).toFixed(1)}" stroke-linecap="${lineCap}" stroke-linejoin="round"
    stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="${begin}" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="${len.toFixed(0)}" to="0" dur="${strokeDuration.toFixed(3)}s" begin="${begin}" fill="freeze"/>
  </path>`);
    }

    // Label: starts invisible, fades in when stroke begins
    if (stroke.points.length > 0) {
      const start = stroke.points[0]!;
      elements.push(`  <g opacity="0">
    <circle cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="4" fill="${color}" opacity="0.7"/>
    <text x="${(start.x + 5).toFixed(1)}" y="${(start.y - 5).toFixed(1)}" font-size="8" fill="${color}" font-family="sans-serif">${i + 1}</text>
    <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="${begin}" fill="freeze"/>
  </g>`);
    }

    timeOffset += strokeDuration + pauseBetween;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 2}" height="${height * 2}">
  <title>${title}</title>
  <rect width="${width}" height="${height}" fill="white"/>
${elements.join('\n')}
</svg>`;
}

export async function writeDebugOutput(
  debugDir: string,
  char: string,
  raster: RasterResult,
  skeletonBitmap: Uint8Array,
  polylines: Point[][],
  strokes: Stroke[],
  lineCap: LineCap = 'round',
): Promise<void> {
  const name = charToFilename(char);
  const glyphDir = join(debugDir, name);
  mkdirSync(glyphDir, { recursive: true });

  const { width, height } = raster;

  // 1. Rasterized bitmap
  await Bun.write(join(glyphDir, '1-bitmap.png'), bitmapToPNG(raster.bitmap, width, height));

  // 2. Skeleton bitmap
  await Bun.write(join(glyphDir, '2-skeleton.png'), bitmapToPNG(skeletonBitmap, width, height));

  // 3. Overlay: skeleton on top of faded bitmap
  const overlayBitmap = new Uint8Array(width * height);
  for (let i = 0; i < overlayBitmap.length; i++) {
    overlayBitmap[i] = raster.bitmap[i]! || skeletonBitmap[i]! ? 1 : 0;
  }
  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 2}" height="${height * 2}">
  <title>${char} - bitmap + skeleton overlay</title>
  <rect width="${width}" height="${height}" fill="white"/>
${Array.from({ length: height }, (_, y) =>
  Array.from({ length: width }, (_, x) => {
    const idx = y * width + x;
    if (skeletonBitmap[idx]) return `  <rect x="${x}" y="${y}" width="1" height="1" fill="red"/>`;
    if (raster.bitmap[idx]) return `  <rect x="${x}" y="${y}" width="1" height="1" fill="#ddd"/>`;
    return '';
  })
    .filter(Boolean)
    .join('\n'),
)
  .filter(Boolean)
  .join('\n')}
</svg>`;
  await Bun.write(join(glyphDir, '3-overlay.svg'), overlaySvg);

  // 4. Traced polylines
  await Bun.write(join(glyphDir, '4-trace.svg'), polylinesToSVG(polylines, width, height, `${char} - traced polylines`, 1.5, lineCap));

  // 5. Animated strokes
  await Bun.write(join(glyphDir, '5-animation.svg'), strokesAnimationSVG(strokes, width, height, `${char} - stroke animation`, lineCap));
}

/**
 * Generate a clean animated SVG for a glyph using font-unit coordinates.
 * Strokes are colored with currentColor and animated via stroke-dashoffset.
 * No debug labels, backgrounds, or overlay information.
 */
export function glyphToAnimatedSVG(
  strokes: { points: { x: number; y: number; t: number; width: number }[]; animationDuration: number; delay: number }[],
  advanceWidth: number,
  ascender: number,
  descender: number,
  lineCap: LineCap = 'round',
): string {
  // Uniform viewBox: baseline at y=0, full em-height, glyph's advanceWidth
  // In the pipeline's coordinate system y is negated (screen coords), so
  // ascender maps to negative y and descender to positive y.
  const vx = 0;
  const vy = -ascender;
  const vw = advanceWidth;
  const vh = ascender - descender;

  const elements: string[] = [];

  for (const stroke of strokes) {
    const d = stroke.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    let pathLen = 0;
    for (let j = 1; j < stroke.points.length; j++) {
      const dx = stroke.points[j]!.x - stroke.points[j - 1]!.x;
      const dy = stroke.points[j]!.y - stroke.points[j - 1]!.y;
      pathLen += Math.sqrt(dx * dx + dy * dy);
    }

    const avgWidth = stroke.points.reduce((s, p) => s + p.width, 0) / stroke.points.length;
    const begin = `${stroke.delay.toFixed(3)}s`;

    if (pathLen === 0) {
      // Single-point stroke (dot): render as a shape that fades in
      const p = stroke.points[0]!;
      const size = Math.max(avgWidth, 0.5);
      elements.push(`  ${dotElement(String(p.x), String(p.y), size, 'currentColor', lineCap)} opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="${stroke.animationDuration.toFixed(3)}s" begin="${begin}" fill="freeze"/>
  </${lineCap === 'round' ? 'circle' : 'rect'}>`);
    } else {
      elements.push(`  <path d="${d}" fill="none" stroke="currentColor" stroke-width="${Math.max(avgWidth, 0.5).toFixed(1)}" stroke-linecap="${lineCap}" stroke-linejoin="round"
    stroke-dasharray="${pathLen.toFixed(1)}" stroke-dashoffset="${pathLen.toFixed(1)}" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.001s" begin="${begin}" fill="freeze"/>
    <animate attributeName="stroke-dashoffset" from="${pathLen.toFixed(1)}" to="0" dur="${stroke.animationDuration.toFixed(3)}s" begin="${begin}" fill="freeze"/>
  </path>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="${vx} ${vy} ${vw} ${vh}">
${elements.join('\n')}
</svg>`;
}
