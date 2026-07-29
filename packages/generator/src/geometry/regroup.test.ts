import { describe, expect, test } from 'bun:test';
import type { Point } from 'tegaki';
import { regroupStrokesByReference } from './regroup.ts';
import type { AxisPoint, GeoStroke } from './types.ts';

const pts = (coords: [number, number][], width = 40): AxisPoint[] => coords.map(([x, y]) => ({ x, y, width }));
const stroke = (points: AxisPoint[], isLoop = false): GeoStroke => ({ points, isLoop, segmentIndices: [0] });
const ref = (coords: [number, number][]): Point[] => coords.map(([x, y]) => ({ x, y }));

const OPTIONS = { spacing: 20, minRunLength: 60, glyphDiag: 800, maxMeanCost: 0.15 };

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

  test('retrace within the NEXT piece: enter its interior, walk to its head, then forward (れ corridor)', () => {
    // Reference travels right, down a corridor, back UP the same corridor,
    // then right again — the font fuses the double-travel into one diagonal,
    // so the extracted continuation piece B starts at the corridor's FAR end
    // while piece A's tail touches B's interior.
    const a = stroke(
      pts(
        [
          [0, 0],
          [95, 0],
        ],
        30,
      ),
    );
    const b = stroke(
      pts(
        [
          [100, 200],
          [100, 5],
          [300, 5],
        ],
        30,
      ),
    );
    const refs = [
      ref([
        [0, 0],
        [100, 0],
        [100, 200],
        [100, 0],
        [300, 0],
      ]),
    ];
    const result = regroupStrokesByReference([a, b], refs, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.merges).toBe(1);
    expect(result!.retraces).toBe(1);
    expect(result!.strokes.length).toBe(1);
    const merged = result!.strokes[0]!;
    // Path: entry → down the corridor to its bottom → back up → out right.
    expect(merged.points[0]!.x).toBe(0);
    expect(Math.max(...ys(merged))).toBe(200);
    const bottomIdx = merged.points.findIndex((p) => p.y === 200);
    expect(bottomIdx).toBeGreaterThan(0);
    expect(bottomIdx).toBeLessThan(merged.points.length - 1);
    expect(merged.points[merged.points.length - 1]!.x).toBe(300);
  });

  test('retrace within the CURRENT piece: walk back from its tail to where the next head touches', () => {
    // Piece A ends deep in the corridor; piece B continues from the
    // corridor's MOUTH — the pen must back out of A along A's own ink.
    const a = stroke(
      pts(
        [
          [0, 0],
          [100, 0],
          [100, 200],
        ],
        30,
      ),
    );
    const b = stroke(
      pts(
        [
          [105, 5],
          [300, 5],
        ],
        30,
      ),
    );
    const refs = [
      ref([
        [0, 0],
        [100, 0],
        [100, 200],
        [100, 0],
        [300, 0],
      ]),
    ];
    const result = regroupStrokesByReference([a, b], refs, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.merges).toBe(1);
    expect(result!.retraces).toBe(1);
    expect(result!.strokes.length).toBe(1);
    const merged = result!.strokes[0]!;
    // Reaches the corridor bottom mid-path, then returns and exits right.
    const bottomIdx = merged.points.findIndex((p) => p.y === 200);
    expect(bottomIdx).toBeGreaterThan(0);
    expect(bottomIdx).toBeLessThan(merged.points.length - 1);
    expect(merged.points[merged.points.length - 1]!.x).toBe(300);
  });

  test('double-sided retrace: a stranded spur backs out to meet the next piece mid-corridor (わ crossing)', () => {
    // Piece A ends on a short spur away from the corridor; piece B starts at
    // the corridor's far end. Neither endpoint reaches the other piece, but
    // the two INTERIORS meet near the corridor mouth — the pen must back out
    // of the spur, then enter the corridor and traverse it both ways.
    const a = stroke(
      pts(
        [
          [0, 0],
          [95, 0],
          [110, -60],
        ],
        30,
      ),
    );
    const b = stroke(
      pts(
        [
          [100, 200],
          [100, 5],
          [300, 5],
        ],
        30,
      ),
    );
    const refs = [
      ref([
        [0, 0],
        [100, 0],
        [100, 200],
        [100, 0],
        [300, 0],
      ]),
    ];
    const result = regroupStrokesByReference([a, b], refs, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.merges).toBe(1);
    expect(result!.retraces).toBe(1);
    expect(result!.strokes.length).toBe(1);
    const merged = result!.strokes[0]!;
    // The spur is drawn out and back...
    const spurIdx = merged.points.findIndex((p) => p.y === -60);
    expect(spurIdx).toBeGreaterThan(0);
    expect(merged.points[spurIdx + 1]!.y).toBeGreaterThan(-60);
    // ...then the corridor bottom is reached mid-path and the stroke exits right.
    const bottomIdx = merged.points.findIndex((p) => p.y === 200);
    expect(bottomIdx).toBeGreaterThan(spurIdx);
    expect(bottomIdx).toBeLessThan(merged.points.length - 1);
    expect(merged.points[merged.points.length - 1]!.x).toBe(300);
  });

  test('via join: the connection rides a THIRD piece assigned to another reference (わ corridor)', () => {
    // The prescribed second stroke runs down the stem corridor between its
    // entry and its bottom sweep — ink the matcher assigns to the STEM
    // reference. The chain must hop onto the stem piece, walk it down, and
    // exit into the sweep.
    const entry = stroke(
      pts(
        [
          [0, 0],
          [95, 0],
        ],
        30,
      ),
    );
    const stem = stroke(
      pts(
        [
          [100, 10],
          [100, 300],
        ],
        30,
      ),
    );
    const sweep = stroke(
      pts(
        [
          [110, 305],
          [300, 305],
        ],
        30,
      ),
    );
    const refs = [
      // Stem reference.
      ref([
        [100, 0],
        [100, 300],
      ]),
      // Second stroke: enters, rides the stem down, sweeps right.
      ref([
        [0, 0],
        [100, 0],
        [100, 300],
        [300, 300],
      ]),
    ];
    const result = regroupStrokesByReference([entry, stem, sweep], refs, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.strokes.length).toBe(2);
    expect(result!.retraces).toBe(1);
    // The merged second stroke travels down the corridor to y≈300 mid-path.
    const merged = result!.strokes.find((s) => s.points[0]!.x === 0)!;
    expect(merged).toBeDefined();
    const bottomIdx = merged.points.findIndex((p) => p.y === 300);
    expect(bottomIdx).toBeGreaterThan(0);
    expect(merged.points[merged.points.length - 1]!.x).toBe(300);
    // The stem itself stays a separate stroke.
    expect(result!.strokes.some((s) => s.points.length === 2 && s.points[0]!.y === 10)).toBe(true);
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
