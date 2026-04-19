import type { Hb } from 'harfbuzzjs';
import type { TegakiBundle } from '../types.ts';

export interface ShapedGlyph {
  /** OpenType glyph id. */
  g: number;
  /** Cluster offset (utf16 code-unit index into the shaped substring). */
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

export interface BundleShaper {
  shape(text: string): ShapedGlyph[];
}

// --- Module-level caches ---------------------------------------------------
// The wasm runtime and each face are expensive to initialize, so we reuse them
// across every engine instance. Face cache is keyed by fontUrl (the bundle's
// stable identifier) and pinned for the process lifetime — there are only a
// handful of fonts in typical usage.

let hbPromise: Promise<Hb> | null = null;

/**
 * Load harfbuzzjs. The package's default entry (`require('harfbuzzjs')`) calls
 * into an Emscripten-generated `hb.js` that tries to locate `hb.wasm` relative
 * to the module's script URL — which is unreliable under modern bundlers that
 * virtualize module paths. We bypass it and point the loader at the wasm URL
 * emitted by `new URL(..., import.meta.url)` (transformed by Vite/Rollup/Webpack5
 * into the final asset URL).
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

const shaperCache = new Map<string, Promise<BundleShaper>>();

/**
 * Build (or reuse) a harfbuzz shaper for a bundle. Returns `null` when the
 * bundle has no variant glyphs (shaping would add nothing) or when the
 * environment can't run harfbuzz (e.g. SSR with no `fetch`). Callers should
 * treat a missing shaper as "no shaping, iterate raw characters" — the
 * renderer's char-keyed glyphData map is the fallback path.
 */
export function getShaperForBundle(bundle: TegakiBundle): Promise<BundleShaper> | null {
  if (typeof fetch === 'undefined') return null;
  if (!bundle.glyphDataById) return null;
  const key = bundle.fontUrl;
  let entry = shaperCache.get(key);
  if (!entry) {
    entry = buildShaper(bundle);
    shaperCache.set(key, entry);
  }
  return entry;
}

async function buildShaper(bundle: TegakiBundle): Promise<BundleShaper> {
  const hb = await getHb();
  const resp = await fetch(bundle.fontUrl);
  const buf = await resp.arrayBuffer();
  const blob = hb.createBlob(buf);
  const face = hb.createFace(blob, 0);
  const font = hb.createFont(face);
  const featureStr = (bundle.features ?? []).join(',');

  return {
    shape(text: string): ShapedGlyph[] {
      if (!text) return [];
      const buffer = hb.createBuffer();
      buffer.addText(text);
      buffer.guessSegmentProperties();
      hb.shape(font, buffer, featureStr || undefined);
      const out = buffer.json();
      buffer.destroy();
      return out;
    },
  };
}
