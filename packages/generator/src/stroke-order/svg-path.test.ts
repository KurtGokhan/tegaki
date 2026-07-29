import { describe, expect, test } from 'bun:test';
import { parseSvgPathData } from './svg-path.ts';

describe('parseSvgPathData', () => {
  test('absolute M/L/C parse to matching commands', () => {
    const cmds = parseSvgPathData('M10 20 L30 40 C50,60 70,80 90,100');
    expect(cmds).toEqual([
      { type: 'M', x: 10, y: 20 },
      { type: 'L', x: 30, y: 40 },
      { type: 'C', x1: 50, y1: 60, x2: 70, y2: 80, x: 90, y: 100 },
    ]);
  });

  test('relative commands accumulate from the cursor', () => {
    const cmds = parseSvgPathData('m10 20 l5 5 c1,1 2,2 3,3');
    expect(cmds).toEqual([
      { type: 'M', x: 10, y: 20 },
      { type: 'L', x: 15, y: 25 },
      { type: 'C', x1: 16, y1: 26, x2: 17, y2: 27, x: 18, y: 28 },
    ]);
  });

  test('coordinate pairs after M continue as L (SVG spec)', () => {
    const cmds = parseSvgPathData('M1 2 3 4 5 6');
    expect(cmds).toEqual([
      { type: 'M', x: 1, y: 2 },
      { type: 'L', x: 3, y: 4 },
      { type: 'L', x: 5, y: 6 },
    ]);
  });

  test('implicit repetition of c consumes triplet after triplet', () => {
    const cmds = parseSvgPathData('M0 0c1,1 2,2 3,3 4,4 5,5 6,6');
    expect(cmds).toEqual([
      { type: 'M', x: 0, y: 0 },
      { type: 'C', x1: 1, y1: 1, x2: 2, y2: 2, x: 3, y: 3 },
      { type: 'C', x1: 7, y1: 7, x2: 8, y2: 8, x: 9, y: 9 },
    ]);
  });

  test('S reflects the previous cubic control point', () => {
    const cmds = parseSvgPathData('M0 0 C 10,10 20,10 30,0 S 50,-10 60,0');
    expect(cmds[2]).toEqual({ type: 'C', x1: 40, y1: -10, x2: 50, y2: -10, x: 60, y: 0 });
  });

  test('S without a preceding cubic uses the current point as first control', () => {
    const cmds = parseSvgPathData('M5 5 S 10,10 20,20');
    expect(cmds[1]).toEqual({ type: 'C', x1: 5, y1: 5, x2: 10, y2: 10, x: 20, y: 20 });
  });

  test('H and V become L at the held coordinate', () => {
    const cmds = parseSvgPathData('M1 2 H10 V20 h5 v5');
    expect(cmds).toEqual([
      { type: 'M', x: 1, y: 2 },
      { type: 'L', x: 10, y: 2 },
      { type: 'L', x: 10, y: 20 },
      { type: 'L', x: 15, y: 20 },
      { type: 'L', x: 15, y: 25 },
    ]);
  });

  test('packed negative numbers and bare decimals scan correctly', () => {
    const cmds = parseSvgPathData('M10-5L.5.25');
    expect(cmds).toEqual([
      { type: 'M', x: 10, y: -5 },
      { type: 'L', x: 0.5, y: 0.25 },
    ]);
  });

  test('Z closes back to the subpath start', () => {
    const cmds = parseSvgPathData('M1 2 L3 4 Z');
    expect(cmds[2]).toEqual({ type: 'Z', x: 1, y: 2 });
  });

  test('arcs are rejected loudly rather than corrupting the stroke', () => {
    expect(() => parseSvgPathData('M0 0 A 5 5 0 0 1 10 10')).toThrow(/Unsupported/);
  });

  test('numbers after Z are malformed, not an infinite loop', () => {
    expect(() => parseSvgPathData('M0 0 Z 1 2')).toThrow(/Malformed/);
  });
});
