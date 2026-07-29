import { describe, expect, test } from 'bun:test';
import type { Point } from 'tegaki';
import { regroupStrokesByReference } from './regroup.ts';
import type { AxisPoint, GeoStroke } from './types.ts';

const pts = (coords: [number, number][], width = 40): AxisPoint[] => coords.map(([x, y]) => ({ x, y, width }));
const stroke = (points: AxisPoint[], isLoop = false): GeoStroke => ({ points, isLoop, segmentIndices: [0] });
const ref = (coords: [number, number][]): Point[] => coords.map(([x, y]) => ({ x, y }));

const OPTIONS = { spacing: 20, minRunLength: 60, glyphDiag: 800 };

const xs = (s: GeoStroke) => s.points.map((p) => p.x);
const ys = (s: GeoStroke) => s.points.map((p) => p.y);
const spanX = (s: GeoStroke) => Math.max(...xs(s)) - Math.min(...xs(s));
const spanY = (s: GeoStroke) => Math.max(...ys(s)) - Math.min(...ys(s));

describe('regroupStrokesByReference — splitting', () => {
  test('a closed box loop splits into the three prescribed strokes (口)', () => {
    // Square ring centerline drawn as one closed loop.
    const loop = stroke(
      pts([
        [100, 100],
        [500, 100],
        [500, 500],
        [100, 500],
        [100, 100],
      ]),
      true,
    );
    // Prescription: left vertical, top+right bent stroke, bottom bar.
    const refs = [
      ref([
        [100, 100],
        [100, 500],
      ]),
      ref([
        [100, 100],
        [500, 100],
        [500, 500],
      ]),
      ref([
        [100, 500],
        [500, 500],
      ]),
    ];
    const result = regroupStrokesByReference([loop], refs, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.splits).toBe(1);
    expect(result!.strokes.length).toBe(3);
    // One part hugs the left side, one covers top+right (both spans large),
    // one hugs the bottom.
    const left = result!.strokes.find((s) => xs(s).every((x) => x < 120))!;
    expect(left).toBeDefined();
    expect(spanY(left)).toBeGreaterThan(300);
    const bent = result!.strokes.find((s) => spanX(s) > 300 && spanY(s) > 300)!;
    expect(bent).toBeDefined();
    const bottom = result!.strokes.find((s) => ys(s).every((y) => y > 480))!;
    expect(bottom).toBeDefined();
    for (const s of result!.strokes) expect(s.isLoop).toBe(false);
  });

  test('crossing another reference does not split the stroke (direction penalty)', () => {
    // Vertical stroke slightly off its own reference; a horizontal reference
    // crosses it at y=350 and is momentarily CLOSER there — but the travel
    // direction never aligns with it, so the label must not flicker.
    const vertical = stroke(
      pts([
        [310, 100],
        [310, 600],
      ]),
    );
    const refs = [
      ref([
        [300, 100],
        [300, 600],
      ]),
      ref([
        [100, 350],
        [500, 350],
      ]),
    ];
    expect(regroupStrokesByReference([vertical], refs, OPTIONS)).toBeNull();
  });

  test('a single stroke matching a single reference is unchanged (null)', () => {
    const bar = stroke(
      pts([
        [200, 100],
        [200, 600],
      ]),
    );
    const refs = [
      ref([
        [200, 100],
        [200, 600],
      ]),
    ];
    expect(regroupStrokesByReference([bar], refs, OPTIONS)).toBeNull();
  });
});

describe('regroupStrokesByReference — merging', () => {
  test('two pieces along one reference chain end-to-end in reference order', () => {
    // Piece B is supplied REVERSED (bottom-up); orientation comes from the
    // reference's arc-length direction, not from the input order.
    const a = stroke(
      pts(
        [
          [100, 100],
          [100, 300],
        ],
        30,
      ),
    );
    const b = stroke(
      pts(
        [
          [100, 600],
          [100, 340],
        ],
        30,
      ),
    );
    const refs = [
      ref([
        [100, 100],
        [100, 600],
      ]),
    ];
    const result = regroupStrokesByReference([b, a], refs, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.merges).toBe(1);
    expect(result!.strokes.length).toBe(1);
    const merged = result!.strokes[0]!;
    // Travels top → bottom following the reference.
    expect(merged.points[0]!.y).toBe(100);
    expect(merged.points[merged.points.length - 1]!.y).toBe(600);
  });

  test('pieces with a large gap along the reference stay separate', () => {
    const a = stroke(
      pts(
        [
          [100, 100],
          [100, 250],
        ],
        30,
      ),
    );
    const b = stroke(
      pts(
        [
          [100, 700],
          [100, 900],
        ],
        30,
      ),
    );
    const refs = [
      ref([
        [100, 100],
        [100, 900],
      ]),
    ];
    // Gap of 450 exceeds both 2×width and 5% of the diagonal — no merge.
    expect(regroupStrokesByReference([a, b], refs, OPTIONS)).toBeNull();
  });

  test('rejected proposals leave the input strokes untouched', () => {
    const a = stroke(
      pts(
        [
          [100, 600],
          [100, 340],
        ],
        30,
      ),
    );
    const before = a.points.map((p) => ({ ...p }));
    const b = stroke(
      pts(
        [
          [100, 100],
          [100, 300],
        ],
        30,
      ),
    );
    const refs = [
      ref([
        [100, 100],
        [100, 600],
      ]),
    ];
    const result = regroupStrokesByReference([a, b], refs, OPTIONS);
    expect(result).not.toBeNull();
    // The caller may reject `result`; the originals must not have been
    // reversed or concatenated in place.
    expect(a.points).toEqual(before);
    expect(b.points.length).toBe(2);
  });
});
