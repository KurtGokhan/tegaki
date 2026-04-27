import type { Hb } from 'harfbuzzjs';
import type { ShaperFactory } from '../core/shaper-registry.ts';
import type { BundleShaper, ShapedGlyph } from '../lib/shaper.ts';
import type { TegakiBundle } from '../types.ts';

const SHAPER_MANAGED_FEATURES = new Set(['init', 'medi', 'fina', 'isol', 'rlig']);

/** Build a harfbuzz feature string from bundle features, filtering shaper-managed enables. */
export function toHbFeatureString(enabled: readonly string[]): string {
  const parts: string[] = [];
  for (const tag of enabled) {
    if (SHAPER_MANAGED_FEATURES.has(tag)) continue;
    parts.push(tag);
  }
  return parts.join(',');
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

async function buildShaper(bundle: TegakiBundle): Promise<BundleShaper> {
  const hb = await getHb();
  const urls = [bundle.fontUrl, ...(bundle.extraFontUrls ?? [])];
  const buffers = await Promise.all(urls.map(async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer())));
  const subsets = buffers.map((buf) => {
    const blob = hb.createBlob(buf);
    const face = hb.createFace(blob, 0);
    const font = hb.createFont(face);
    // Pre-scan the cmap so per-cluster routing is a hash lookup, not a wasm
    // call. `collectUnicodes` returns every codepoint the face's cmap maps to
    // a non-`.notdef` glyph — exactly what we need to decide whether this
    // subset can shape a given cluster.
    const codepoints = new Set<number>(face.collectUnicodes());
    return { font, face, blob, codepoints };
  });
  const featureStr = toHbFeatureString(bundle.features ?? []);

  // Shape `runText` with `subsetIdx`'s font, then prefix output glyph ids with
  // the subset index so lookups in `glyphDataById` pick the right entry.
  // Glyphs from subset 0 (primary) keep their bare numeric key for backward
  // compatibility with single-subset bundles.
  const shapeRun = (subsetIdx: number, runText: string, runStart: number): ShapedGlyph[] => {
    const subset = subsets[subsetIdx]!;
    const buffer = hb.createBuffer();
    buffer.addText(runText);
    buffer.guessSegmentProperties();
    hb.shape(subset.font, buffer, featureStr || undefined);
    const out = buffer.json() as Array<{ g: number; cl: number; ax: number; ay: number; dx: number; dy: number }>;
    buffer.destroy();
    const prefix = subsetIdx === 0 ? '' : `${subsetIdx}:`;
    return out.map((g) => ({
      g: `${prefix}${g.g}`,
      cl: runStart + g.cl,
      ax: g.ax,
      ay: g.ay,
      dx: g.dx,
      dy: g.dy,
    }));
  };

  // Pick the subset that covers `cp` — primary-first, so shared codepoints
  // (e.g. a space or Latin digit present in both subsets) stick with the
  // primary face. Returns -1 when no subset has a cmap entry — the caller
  // still shapes the run against the primary (produces `.notdef`, which the
  // renderer's char-keyed fallback can handle).
  const pickSubset = (cp: number): number => {
    for (let i = 0; i < subsets.length; i++) {
      if (subsets[i]!.codepoints.has(cp)) return i;
    }
    return -1;
  };

  return {
    shape(text: string): ShapedGlyph[] {
      if (!text) return [];
      // Fast path: single-subset bundles keep the old behaviour with no per-
      // char routing overhead.
      if (subsets.length === 1) return shapeRun(0, text, 0);

      // Split text into runs where every char resolves to the same subset.
      // Shaping must not cross a run boundary — different subsets may have
      // different script-default features, and a lookup table in one subset
      // should never see glyphs from another.
      const out: ShapedGlyph[] = [];
      let runStart = 0;
      let runSubset = -2;
      const flush = (endUtf16: number) => {
        if (endUtf16 === runStart) return;
        const effective = runSubset < 0 ? 0 : runSubset;
        out.push(...shapeRun(effective, text.slice(runStart, endUtf16), runStart));
      };
      for (let i = 0; i < text.length; ) {
        const cp = text.codePointAt(i) ?? text.charCodeAt(i);
        const step = cp > 0xffff ? 2 : 1;
        const subset = pickSubset(cp);
        if (subset !== runSubset) {
          flush(i);
          runStart = i;
          runSubset = subset;
        }
        i += step;
      }
      flush(text.length);
      return out;
    },
  };
}

/**
 * Harfbuzz shaper factory. Pass to `TegakiEngine.registerShaper` once at app
 * startup to enable complex shaping (ligatures, contextual alternates,
 * Arabic/Indic scripts) for every bundle that declares `glyphDataById`.
 *
 * ```ts
 * import { TegakiEngine } from 'tegaki/core';
 * import harfbuzzShaper from 'tegaki/shaper-harfbuzz';
 * TegakiEngine.registerShaper(harfbuzzShaper);
 * ```
 *
 * Declines bundles without `glyphDataById` (nothing to resolve shaped glyph
 * ids against) and environments without `fetch` (SSR). The renderer's
 * char-keyed fallback handles both cases.
 */
const harfbuzzShaper: ShaperFactory = (bundle) => {
  if (typeof fetch === 'undefined') return null;
  if (!bundle.glyphDataById) return null;
  return buildShaper(bundle);
};

export default harfbuzzShaper;
