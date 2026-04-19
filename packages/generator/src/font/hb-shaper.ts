import type { Hb } from 'harfbuzzjs';

let hbPromise: Promise<Hb> | null = null;

/**
 * Load harfbuzzjs. The package's default entry calls into an Emscripten wrapper
 * that locates `hb.wasm` relative to its script URL — unreliable under bundlers
 * that virtualize module paths (Vite, Webpack). We bypass it and point the
 * loader at the wasm URL emitted by `new URL(..., import.meta.url)`, which
 * modern bundlers transform into the final asset URL.
 */
function getHb(): Promise<Hb> {
  if (!hbPromise) {
    hbPromise = (async () => {
      const [hbMod, hbjsMod] = await Promise.all([import('harfbuzzjs/hb.js'), import('harfbuzzjs/hbjs.js')]);
      const wasmUrl = new URL('harfbuzzjs/hb.wasm', import.meta.url).href;
      const instance = await hbMod.default({ locateFile: () => wasmUrl });
      return hbjsMod.default(instance);
    })();
  }
  return hbPromise;
}

/**
 * List every feature tag declared in the font's GSUB table — these are the
 * substitutions the font is capable of (ligatures, contextual alternates,
 * positional forms for Arabic, stylistic sets, etc.). We enable all of them
 * during variant discovery so the pipeline captures every glyph the font can
 * produce, not just the `liga`/`calt` subset.
 *
 * `aalt` ("access all alternates") is filtered out: it's a UI/menu feature
 * whose lookups indiscriminately swap every glyph with any alternate to some
 * default alternate. Enabling it would produce a visually destructive bundle
 * that doesn't match what browsers render by default.
 */
export async function getGsubFeatures(fontBuffer: ArrayBuffer): Promise<string[]> {
  const hb = await getHb();
  const blob = hb.createBlob(fontBuffer);
  const face = hb.createFace(blob, 0);
  try {
    // `getTableFeatureTags` returns one entry per (script, language) feature
    // registration, so tags like `ccmp` or `locl` show up once per script the
    // font covers. Dedupe while preserving first-seen order so the UI list
    // stays stable.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tag of face.getTableFeatureTags('GSUB')) {
      if (tag === 'aalt' || seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
    return out;
  } finally {
    face.destroy();
    blob.destroy();
  }
}

export interface ShapedGlyph {
  /** OpenType glyph id returned by harfbuzz shaping. */
  g: number;
  /** Source-text cluster (utf16 code-unit offset into the input string). */
  cl: number;
  /** X advance in font units. */
  ax: number;
  /** Y advance in font units. */
  ay: number;
  /** X offset (displacement from pen position) in font units. */
  dx: number;
  /** Y offset (displacement from pen position) in font units. */
  dy: number;
}

export interface HbShaper {
  /** Shape `text`, returning one entry per output glyph. */
  shape(text: string): ShapedGlyph[];
  /** Glyph id the font would emit for `char` with no shaping / features. */
  charToGlyphId(char: string): number;
  destroy(): void;
}

/**
 * Create a harfbuzz shaper bound to `fontBuffer`. `features` are applied on
 * top of harfbuzz's script-based defaults during shaping. Pass the font's
 * GSUB feature list (see `getGsubFeatures`) to surface every substitution the
 * font can produce. The resulting shaper is stateful and owns wasm memory —
 * call `destroy()` when done.
 */
export async function createHbShaper(fontBuffer: ArrayBuffer, features: string[] = []): Promise<HbShaper> {
  const hb = await getHb();
  const blob = hb.createBlob(fontBuffer);
  const face = hb.createFace(blob, 0);
  const font = hb.createFont(face);
  const featureStr = features.join(',');

  // A fresh buffer per shape keeps state isolated and avoids the need to
  // guess-reset between calls. Shaping is cheap; reusing a buffer would only
  // matter in very tight loops.
  const shape = (text: string): ShapedGlyph[] => {
    const buffer = hb.createBuffer();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    hb.shape(font, buffer, featureStr || undefined);
    const out = buffer.json() as Array<{ g: number; cl: number; ax: number; ay: number; dx: number; dy: number }>;
    buffer.destroy();
    return out.map((g) => ({ g: g.g, cl: g.cl, ax: g.ax, ay: g.ay, dx: g.dx, dy: g.dy }));
  };

  const charToGlyphId = (char: string): number => {
    // Shape the char with all features disabled to get the nominal glyph id.
    // Faster than querying the cmap via a dedicated API (harfbuzzjs doesn't
    // expose one) and produces the same result for isolated characters.
    const buffer = hb.createBuffer();
    buffer.addText(char);
    buffer.guessSegmentProperties();
    hb.shape(font, buffer, '-liga,-calt,-clig,-dlig,-rlig');
    const out = buffer.json() as Array<{ g: number }>;
    buffer.destroy();
    return out[0]?.g ?? 0;
  };

  return {
    shape,
    charToGlyphId,
    destroy() {
      font.destroy();
      face.destroy();
      blob.destroy();
    },
  };
}
