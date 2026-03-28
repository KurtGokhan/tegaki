# handy-text

CLI tool that generates glyph data for handwriting animation from Google Fonts.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode, ESNext, nodenext modules)
- **CLI framework**: [Padrone](https://github.com/nicobrinkkemper/padrone) - schema-first CLI with Zod v4
- **Font parsing**: opentype.js
- **Linter/Formatter**: Biome (2-space indent, single quotes, 140 line width)
- **Testing**: Bun's built-in test runner

## Commands

```bash
bun run start          # Run the CLI
bun run dev            # Watch mode
bun run test           # Run tests
bun run typecheck      # TypeScript checks
bun run check          # Biome lint + format check
bun run fix            # Biome auto-fix
bun run checks         # All checks: lint + format + typecheck + tests
```

## Architecture

### CLI Entry Point

`src/index.ts` uses Padrone to define the CLI. Commands are defined in `src/commands/` and passed as builder callbacks to `.command()`.

The `generate` command is the main feature. It orchestrates a pipeline that processes each glyph through several stages.

### Pipeline (per glyph)

```
Font download -> Parse (opentype.js) -> Flatten beziers -> Rasterize -> Skeletonize -> Trace -> Compute width -> Order strokes -> JSON output
```

1. **Extract** (`src/font/parse.ts`): opentype.js extracts path commands and metrics
2. **Flatten** (`src/processing/bezier.ts`): Adaptive de Casteljau subdivision converts bezier curves to polyline segments
3. **Rasterize** (`src/processing/rasterize.ts`): Scanline fill with nonzero winding rule produces a binary bitmap
4. **Skeletonize** (`src/processing/skeletonize.ts`): Zhang-Suen thinning reduces the bitmap to 1px-wide skeleton
5. **Trace** (`src/processing/trace.ts`): Walks skeleton pixels into polylines, prunes short spurs, simplifies with Ramer-Douglas-Peucker
6. **Width** (`src/processing/width.ts`): Distance transform computes stroke width (diameter) at each skeleton point
7. **Stroke order** (`src/processing/stroke-order.ts`): Groups polylines into connected components, sorts top-to-bottom/left-to-right, orients strokes, assigns `t` parameter (0-1 animation progress)

### Key Design Decisions

- **Pure TypeScript processing**: All image processing (rasterizer, Zhang-Suen, distance transform, RDP) is implemented from scratch to avoid native addon dependencies (no canvas, no sharp).
- **Coordinate system mismatch**: opentype.js `glyph.getPath()` outputs screen coordinates (y-down) while `glyph.getBoundingBox()` returns font coordinates (y-up). The pipeline computes bounding boxes from actual path points, not from opentype's bbox.
- **Spur pruning**: The Zhang-Suen skeleton produces noisy spur branches at thick stroke endpoints. These are pruned proportionally to bitmap size (8% of resolution, capped at 10px). If all polylines would be pruned (tiny glyphs like `.`), the longest one is kept.
- **Font caching**: Downloaded .ttf files are cached in `.cache/fonts/`. The Google Fonts CSS endpoint is fetched with a non-browser User-Agent to get .ttf URLs (not woff2).

### File Structure

```
src/
  index.ts                    # CLI entry point (Padrone)
  index.test.ts               # Tests
  types.ts                    # Shared types: Point, TimedPoint, BBox, Stroke, GlyphData, FontOutput, PathCommand
  constants.ts                # Defaults: resolution (200), chars, font family (Caveat), tolerances
  commands/
    generate.ts               # Generate command: orchestrates full pipeline
  font/
    download.ts               # Google Fonts download + local .ttf caching
    parse.ts                  # opentype.js wrapper
  processing/
    bezier.ts                 # Bezier curve flattening (adaptive subdivision)
    rasterize.ts              # Scanline fill rasterizer (nonzero winding rule)
    skeletonize.ts            # Zhang-Suen thinning algorithm
    trace.ts                  # Skeleton pixel tracing + RDP simplification + spur pruning
    width.ts                  # Distance transform for stroke width
    stroke-order.ts           # Connected component grouping + heuristic ordering
```

### Output Format

The `generate` command outputs a JSON file with this structure:

```json
{
  "font": { "family": "Caveat", "style": "Regular", "unitsPerEm": 1000, "ascender": 960, "descender": -300 },
  "glyphs": {
    "A": {
      "char": "A",
      "unicode": 65,
      "advanceWidth": 502,
      "boundingBox": { "x1": ..., "y1": ..., "x2": ..., "y2": ... },
      "path": "<SVG path string>",
      "skeleton": [[{"x": ..., "y": ...}, ...], ...],
      "strokes": [
        { "points": [{"x": ..., "y": ..., "t": 0, "width": 45.2}, ...], "order": 0 }
      ]
    }
  }
}
```

Each stroke point has: `x`, `y` (font units), `t` (0-1 animation progress along stroke), `width` (stroke diameter in font units).

## Conventions

- Padrone command builders use `AnyPadroneBuilder` type (not `PadroneCommandBuilder` which doesn't exist)
- Biome auto-formats on commit via husky + lint-staged
- Imports use `.ts` extensions (`import { foo } from './bar.ts'`)
- Zod is imported as `import * as z from 'zod/v4'` (not default import)
