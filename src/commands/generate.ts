import { mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { transform as svgrTransform } from '@svgr/core';
import { padroneProgress } from 'padrone';
import * as z from 'zod/v4';
import { DEFAULT_CHARS, DEFAULT_FONT_FAMILY, DEFAULT_RESOLUTION, SKELETON_METHOD, VORONOI_SAMPLING_INTERVAL } from '../constants.ts';
import { charToFilename, glyphToAnimatedSVG, writeDebugOutput } from '../debug/output.ts';
import { downloadFont } from '../font/download.ts';
import { extractGlyph, loadFont } from '../font/parse.ts';
import { flattenPath } from '../processing/bezier.ts';
import { rasterize } from '../processing/rasterize.ts';
import { skeletonize } from '../processing/skeletonize.ts';
import { orderStrokes } from '../processing/stroke-order.ts';
import { traceAndSimplify } from '../processing/trace.ts';
import { voronoiMedialAxis } from '../processing/voronoi-medial-axis.ts';
import { computeInverseDistanceTransform } from '../processing/width.ts';
import type { BBox, FontOutput, Point } from '../types.ts';

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

function transformPointsToFontUnits(
  points: Point[],
  transform: { scaleX: number; scaleY: number; offsetX: number; offsetY: number },
): Point[] {
  return points.map((p) => ({
    x: Math.round((p.x / transform.scaleX + transform.offsetX) * 100) / 100,
    y: Math.round((p.y / transform.scaleY + transform.offsetY) * 100) / 100,
  }));
}

export const generateCommand = (c: any) =>
  c
    .extend(
      padroneProgress({
        spinner: true,
        bar: true,
        time: true,
        eta: true,
      }),
    )
    .configure({
      title: 'Generate glyph data from a Google Font',
      description: 'Downloads a font, extracts glyph outlines, computes skeletons and stroke order, then writes a JSON file.',
    })
    .arguments(
      z.object({
        family: z.string().default(DEFAULT_FONT_FAMILY).describe('Google Fonts family name'),
        output: z.string().optional().describe('Output JSON file path').meta({ flags: 'o' }),
        resolution: z.number().default(DEFAULT_RESOLUTION).describe('Bitmap resolution for skeletonization').meta({ flags: 'r' }),
        chars: z.string().default(DEFAULT_CHARS).describe('Characters to process').meta({ flags: 'c' }),
        force: z.boolean().default(false).describe('Re-download font even if cached').meta({ flags: 'f' }),
        debug: z
          .boolean()
          .default(false)
          .describe('Output intermediate steps (bitmap, skeleton, trace, animation SVGs)')
          .meta({ flags: 'd' }),
      }),
      { positional: ['family'] },
    )
    .action(async (args: any, ctx: any) => {
      const progress = ctx.context.progress;
      const outputPath = args.output ?? `output/${args.family.toLowerCase().replace(/\s+/g, '-')}.json`;
      const debugDir = args.debug ? `${dirname(outputPath)}/debug` : null;

      progress.update(`Downloading font "${args.family}"...`);
      const fontPath = await downloadFont(args.family, { force: args.force });

      progress.update('Parsing font...');
      const parsed = await loadFont(fontPath);

      progress.update({ message: `Processing ${parsed.family} ${parsed.style} (${parsed.unitsPerEm} units/em)`, progress: 0 });

      const output: FontOutput = {
        font: {
          family: parsed.family,
          style: parsed.style,
          unitsPerEm: parsed.unitsPerEm,
          ascender: parsed.ascender,
          descender: parsed.descender,
        },
        glyphs: {},
      };

      const chars = [...args.chars];
      let processed = 0;
      let skipped = 0;

      for (const char of chars) {
        const rawGlyph = extractGlyph(parsed.font, char);
        if (!rawGlyph) {
          skipped++;
          continue;
        }

        const subPaths = flattenPath(rawGlyph.commands);
        const pathBBox = computePathBBox(subPaths);
        const raster = rasterize(subPaths, pathBBox, args.resolution);

        let polylines: Point[][];
        let inverseDT: Float32Array | null;
        let voronoiWidths: number[][] | undefined;
        let skeleton: Uint8Array | null = null;

        if (SKELETON_METHOD === 'voronoi') {
          const vResult = voronoiMedialAxis(subPaths, pathBBox, raster.transform, raster.width, raster.height, VORONOI_SAMPLING_INTERVAL);
          polylines = vResult.polylines;
          voronoiWidths = vResult.widths;
          inverseDT = null;
        } else {
          skeleton = await skeletonize(raster.bitmap, raster.width, raster.height);
          inverseDT = computeInverseDistanceTransform(raster.bitmap, raster.width, raster.height);
          polylines = traceAndSimplify(skeleton, raster.width, raster.height);
        }

        const strokes = orderStrokes(polylines, inverseDT, raster.width, 3, voronoiWidths);

        if (debugDir) {
          const debugSkeleton = skeleton ?? new Uint8Array(raster.width * raster.height);
          await writeDebugOutput(debugDir, char, raster, debugSkeleton, polylines, strokes);
        }

        const skeletonFontUnits = polylines.map((pl) => transformPointsToFontUnits(pl, raster.transform));

        const scale = raster.transform.scaleX;
        const strokesFontUnits = strokes.map((s) => ({
          ...s,
          length: Math.round((s.length / scale) * 100) / 100,
          points: s.points.map((p) => ({
            x: Math.round((p.x / raster.transform.scaleX + raster.transform.offsetX) * 100) / 100,
            y: Math.round((p.y / raster.transform.scaleY + raster.transform.offsetY) * 100) / 100,
            t: Math.round(p.t * 1000) / 1000,
            width: Math.round((p.width / scale) * 100) / 100,
          })),
        }));

        const totalLength = strokesFontUnits.reduce((sum, s) => sum + s.length, 0);

        output.glyphs[char] = {
          char: rawGlyph.char,
          unicode: rawGlyph.unicode,
          advanceWidth: rawGlyph.advanceWidth,
          boundingBox: rawGlyph.boundingBox,
          path: rawGlyph.pathString,
          skeleton: skeletonFontUnits,
          strokes: strokesFontUnits,
          totalLength: Math.round(totalLength * 100) / 100,
        };

        processed++;
        progress.update({ message: `Processing glyph "${char}"`, progress: processed / chars.length });
      }

      mkdirSync(dirname(outputPath), { recursive: true });
      await Bun.write(outputPath, JSON.stringify(output, null, 2));

      // Write animated SVGs and SVGR-transformed TSX components for each glyph
      const svgDir = join(dirname(outputPath), 'svg');
      mkdirSync(svgDir, { recursive: true });
      const glyphEntries: { char: string; basename: string }[] = [];
      for (const glyph of Object.values(output.glyphs)) {
        const basename = charToFilename(glyph.char);
        const svg = glyphToAnimatedSVG(glyph.strokes, glyph.totalLength);
        await Bun.write(join(svgDir, `${basename}.svg`), svg);

        const tsx = await svgrTransform(svg, {
          plugins: ['@svgr/plugin-jsx'],
          jsxRuntime: 'automatic',
          exportType: 'default',
          typescript: true,
        });
        await Bun.write(join(svgDir, `${basename}.tsx`), tsx);

        glyphEntries.push({ char: glyph.char, basename });
      }

      // Generate glyphs.ts with explicit imports for the frontend
      const glyphsTs = generateGlyphsModule(glyphEntries, svgDir);
      await Bun.write('src/frontend/glyphs.ts', glyphsTs);

      progress.succeed(`Processed ${processed} glyphs (${skipped} skipped). Output: ${outputPath}`);

      return { outputPath, processed, skipped };
    });

const GLYPHS_TS_DIR = 'src/frontend';

function generateGlyphsModule(entries: { char: string; basename: string }[], svgDir: string): string {
  const relDir = relative(GLYPHS_TS_DIR, svgDir).replaceAll('\\', '/');

  const imports: string[] = [];
  const mapEntries: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { char, basename } = entries[i]!;
    const varName = `_${i}`;
    imports.push(`import ${varName} from '${relDir}/${basename}.tsx';`);

    const escaped = char === '\\' ? '\\\\' : char === "'" ? "\\'" : char;
    mapEntries.push(`  '${escaped}': ${varName},`);
  }

  return `// Auto-generated by the generate command. Do not edit manually.
import type { FC, SVGProps } from 'react';

type SvgComponent = FC<SVGProps<SVGSVGElement>>;

${imports.join('\n')}

export const glyphs: Record<string, SvgComponent> = {
${mapEntries.join('\n')}
};
`;
}
