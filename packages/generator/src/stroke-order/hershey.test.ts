import { describe, expect, test } from 'bun:test';
import { createHersheyProvider } from './hershey.ts';
import { collectReferences } from './providers.ts';
import type { ReferenceGlyph, StrokeOrderProvider } from './types.ts';

describe('createHersheyProvider', () => {
  test('cursive letters are single pen trajectories (m, n, h)', async () => {
    const provider = createHersheyProvider();
    for (const char of ['m', 'n', 'h', 'M', 'N']) {
      const ref = await provider.get(char);
      expect(ref).not.toBeNull();
      expect(ref!.strokes.length).toBe(1);
      expect(ref!.source).toBe('hershey-script');
    }
  });

  test('detached marks stay separate strokes (i keeps its dot)', async () => {
    const provider = createHersheyProvider();
    const ref = await provider.get('i');
    expect(ref!.strokes.length).toBe(2);
  });

  test('digits and non-Latin characters have no entry', async () => {
    const provider = createHersheyProvider();
    expect(await provider.get('7')).toBeNull();
    expect(await provider.get('あ')).toBeNull();
  });

  test('results are cached per character', async () => {
    const provider = createHersheyProvider();
    const a = await provider.get('a');
    const b = await provider.get('a');
    expect(a).toBe(b!);
  });
});

describe('collectReferences', () => {
  const glyph = (source: string): ReferenceGlyph => ({
    char: 'x',
    strokes: [
      {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    ],
    viewBox: { width: 10, height: 10 },
    source,
    license: 'test',
  });
  const provider = (name: string, ref: ReferenceGlyph | null, fail = false): StrokeOrderProvider => ({
    name,
    get: async () => {
      if (fail) throw new Error('boom');
      return ref;
    },
  });

  test('gathers variants in provider order, skipping misses and failures', async () => {
    const refs = await collectReferences('x', [
      provider('a', glyph('a')),
      provider('miss', null),
      provider('fail', null, true),
      provider('b', glyph('b')),
    ]);
    expect(refs.map((r) => r.source)).toEqual(['a', 'b']);
  });
});
