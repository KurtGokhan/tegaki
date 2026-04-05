import { mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createPadrone, padroneProgress } from 'padrone';
import { extractTegakiBundle, generateArgsSchema, type PipelineOptions } from '../commands/generate.ts';
import { writeDebugOutput } from '../debug/output.ts';
import { downloadFont } from '../font/download.ts';

export const tegakiProgram = createPadrone('tegaki')
  .configure({
    description: 'Generate glyph data for handwriting animation',
  })
  .command('generate', (c) =>
    c
      .extend(padroneProgress({ spinner: true, bar: true, time: true, eta: true }))
      .configure({
        title: 'Generate glyph data from a Google Font',
        description: 'Downloads a font, extracts glyph outlines, computes skeletons and stroke order, then writes a JSON file.',
      })
      .arguments(generateArgsSchema, { positional: ['family'] })
      .action(async (args, ctx) => {
        const progress = ctx.context.progress;
        const { family, output, force, debug, chars, ...pipelineOptions } = args;

        // Download and read font
        progress?.update(`Downloading font "${family}"...`);
        const fontPath = await downloadFont(family, { force });
        const fontBuffer = await Bun.file(fontPath).arrayBuffer();
        const fontFileName = basename(fontPath);

        // Extract bundle (pure — no file I/O)
        progress?.update('Processing font...');
        const bundle = extractTegakiBundle({
          fontBuffer,
          fontFileName,
          chars,
          options: pipelineOptions as PipelineOptions,
          onProgress: (msg, p) => {
            if (p !== undefined) {
              progress?.update({ message: msg, progress: p });
            } else {
              progress?.update(msg);
            }
          },
        });

        // Write bundle files to disk
        const outputDir = output ?? `output/${family.toLowerCase().replace(/\s+/g, '-')}`;
        for (const file of bundle.files) {
          const filePath = join(outputDir, file.path);
          mkdirSync(dirname(filePath), { recursive: true });
          await Bun.write(filePath, file.content);
        }

        // Write debug output if requested
        if (debug) {
          const debugDir = join(outputDir, 'debug');
          await Bun.write(join(debugDir, 'font.json'), JSON.stringify(bundle.fontOutput, null, 2));
          for (const [char, result] of Object.entries(bundle.glyphResults)) {
            await writeDebugOutput(debugDir, char, result);
          }
        }

        progress?.succeed(`Processed ${bundle.stats.processed} glyphs (${bundle.stats.skipped} skipped). Output: ${outputDir}`);
        return { outputDir, ...bundle.stats };
      }),
  );

if (import.meta.main) await tegakiProgram.cli().drain();
