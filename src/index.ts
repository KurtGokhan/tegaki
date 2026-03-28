import { createPadrone } from 'padrone';
import * as z from 'zod/v4';

export const program = createPadrone('handy-text')
  .configure({
    description: 'Handy Text CLI',
    version: '0.1.0',
  })
  .action(() => {
    console.log(program.help());
  })
  .command('hello', (c) =>
    c
      .configure({ title: 'Print a greeting message' })
      .arguments(
        z.object({
          name: z.string().optional(),
        }),
        { positional: ['name'] },
      )
      .action((args) => {
        console.log(`Hello, ${args.name}!`);
      }),
  );

if (import.meta.main) await program.cli().drain();
