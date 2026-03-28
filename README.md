# Handy Text

CLI tool that generates glyph data for handwriting animation. It downloads fonts from Google Fonts, extracts glyph outlines, computes single-stroke skeletons, and determines natural stroke order for animation.

## Getting Started

```bash
# Install dependencies
bun install

# Generate glyph data (defaults to Caveat font)
bun start generate

# Specify a font
bun start generate "Roboto"

# Custom output path and resolution
bun start generate "Caveat" -o output/caveat.json -r 300
```

## Usage

```
Usage: handy-text generate [family] [options]

Arguments:
  family                Google Fonts family name (default: Caveat)

Options:
  -o, --output          Output JSON file path (default: output/<family>.json)
  -r, --resolution      Bitmap resolution for skeletonization (default: 200)
  -c, --chars           Characters to process (default: printable ASCII subset)
  -f, --force           Re-download font even if cached
```

## Output Format

The generated JSON contains font metadata and per-glyph data:

```jsonc
{
  "font": { "family": "Caveat", "style": "Regular", "unitsPerEm": 1000, ... },
  "glyphs": {
    "A": {
      "char": "A",
      "unicode": 65,
      "advanceWidth": 502,
      "boundingBox": { "x1": ..., "y1": ..., "x2": ..., "y2": ... },
      "path": "<SVG path>",
      "skeleton": [[{ "x": ..., "y": ... }, ...], ...],
      "strokes": [
        { "points": [{ "x": ..., "y": ..., "t": 0, "width": 45.2 }, ...], "order": 0 }
      ]
    }
  }
}
```

Each stroke point includes:
- **x, y** - Position in font units
- **t** - Animation progress along the stroke (0 to 1)
- **width** - Stroke diameter in font units

## How It Works

1. **Download** font from Google Fonts (cached locally in `.cache/fonts/`)
2. **Parse** font with opentype.js to extract glyph outlines
3. **Flatten** bezier curves to polyline segments
4. **Rasterize** outlines to a binary bitmap via scanline fill
5. **Skeletonize** using Zhang-Suen thinning algorithm
6. **Trace** skeleton pixels into polylines with Ramer-Douglas-Peucker simplification
7. **Compute stroke width** via distance transform
8. **Order strokes** heuristically (top-to-bottom, left-to-right)

## Scripts

| Script              | Description                      |
| ------------------- | -------------------------------- |
| `bun start`         | Run the CLI                      |
| `bun run dev`       | Run with file watching           |
| `bun run typecheck` | TypeScript type checking         |
| `bun run check`     | Biome lint + format check        |
| `bun run fix`       | Biome auto-fix                   |
| `bun run test`      | Run tests                        |
