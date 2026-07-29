import { describe, expect, test } from 'bun:test';
import { createKanjiVGProvider, kanjiVGFilename, parseKanjiVGSvg } from './kanjivg.ts';

// Trimmed but structurally faithful KanjiVG file for 十 (U+5341, 2 strokes):
// StrokePaths group with kvg: attributes, then a StrokeNumbers group whose
// <text> elements must not leak into the stroke list.
const JUU_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109">
<g id="kvg:StrokePaths_05341" style="fill:none;stroke:#000000;stroke-width:3">
<g id="kvg:05341" kvg:element="十">
\t<path id="kvg:05341-s1" kvg:type="㇐" d="M11,53.25c2.6,0.5,5.55,0.6,8.14,0.35c17.55-1.71,53.36-5.1,72.29-5.24c2.76-0.02,5.32,0.1,8.07,0.64"/>
\t<path id="kvg:05341-s2" kvg:type="㇑" d="M53.12,12c1.42,1.42,2.04,3.12,2.04,5.51c0,26.24,0.09,60.36,0.09,71.11c0,16.62,0.12,10.5,0.12,14.38"/>
</g>
</g>
<g id="kvg:StrokeNumbers_05341" style="font-size:8;fill:#808080">
\t<text transform="matrix(1 0 0 1 4.50 54.50)">1</text>
\t<text transform="matrix(1 0 0 1 46.50 12.50)">2</text>
</g>
</svg>`;

describe('kanjiVGFilename', () => {
  test('codepoints pad to 5 lowercase hex digits', () => {
    expect(kanjiVGFilename('手')).toBe('0624b.svg');
    expect(kanjiVGFilename('あ')).toBe('03042.svg');
  });
});

describe('parseKanjiVGSvg', () => {
  test('strokes come out in prescribed order with type labels', () => {
    const ref = parseKanjiVGSvg(JUU_SVG, '十');
    expect(ref).not.toBeNull();
    expect(ref!.strokes.length).toBe(2);
    expect(ref!.strokes[0]!.type).toBe('㇐');
    expect(ref!.strokes[1]!.type).toBe('㇑');
    expect(ref!.viewBox).toEqual({ width: 109, height: 109 });
    expect(ref!.source).toBe('kanjivg');
    expect(ref!.license).toContain('CC BY-SA');
  });

  test('point order preserves pen direction: horizontal left→right, vertical top→bottom', () => {
    const ref = parseKanjiVGSvg(JUU_SVG, '十')!;
    const [horizontal, vertical] = ref.strokes;
    const h = horizontal!.points;
    const v = vertical!.points;
    expect(h[0]!.x).toBeCloseTo(11);
    expect(h[h.length - 1]!.x).toBeGreaterThan(90);
    expect(v[0]!.y).toBeCloseTo(12);
    expect(v[v.length - 1]!.y).toBeGreaterThan(90);
  });

  test('curves are flattened into dense polylines, not endpoint hops', () => {
    const ref = parseKanjiVGSvg(JUU_SVG, '十')!;
    for (const stroke of ref.strokes) expect(stroke.points.length).toBeGreaterThan(4);
  });

  test('stroke order follows the -sN id even when document order disagrees', () => {
    const swapped = JUU_SVG.replace('-s1"', '-sTMP"').replace('-s2"', '-s1"').replace('-sTMP"', '-s2"');
    const ref = parseKanjiVGSvg(swapped, '十')!;
    // The vertical (originally s2, now s1) must come first.
    expect(ref.strokes[0]!.type).toBe('㇑');
    expect(ref.strokes[1]!.type).toBe('㇐');
  });

  test('a document with no stroke paths returns null', () => {
    expect(parseKanjiVGSvg('<svg viewBox="0 0 109 109"><g id="kvg:StrokeNumbers_x"><text>1</text></g></svg>', 'x')).toBeNull();
  });
});

describe('createKanjiVGProvider', () => {
  test('memoizes: the loader runs once per character', async () => {
    let calls = 0;
    const provider = createKanjiVGProvider(async () => {
      calls++;
      return JUU_SVG;
    });
    const a = await provider.get('十');
    const b = await provider.get('十');
    expect(a).toBe(b!);
    expect(a!.strokes.length).toBe(2);
    expect(calls).toBe(1);
  });

  test('characters outside the dataset resolve to null', async () => {
    const provider = createKanjiVGProvider(async () => null);
    expect(await provider.get('A')).toBeNull();
  });
});
