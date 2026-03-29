import { createPadrone } from 'padrone';
import { generateCommand } from '../commands/generate.ts';

export const tegakiProgram = createPadrone('tegaki')
  .configure({
    description: 'Generate glyph data for handwriting animation',
  })
  .command('generate', generateCommand)
  .command('serve', (c) => c.action(() => import('../server.ts').then(({ serveTegakiWeb }) => serveTegakiWeb())));

if (import.meta.main) await tegakiProgram.cli().drain();
