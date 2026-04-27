import type { BundleShaper } from '../lib/shaper.ts';
import type { TegakiBundle } from '../types.ts';

/**
 * Factory invoked once per bundle to produce (or decline) a shaper.
 *
 * Return `null` when the bundle doesn't need shaping or the environment can't
 * run it — the renderer falls back to its char-keyed glyph path. Return a
 * `Promise<BundleShaper>` when shaper init is async (wasm load, font fetch).
 */
export type ShaperFactory = (bundle: TegakiBundle) => Promise<BundleShaper> | null;

let factory: ShaperFactory | null = null;
const shaperCache = new Map<string, Promise<BundleShaper>>();

/**
 * Register a shaper factory. Shaping is opt-in — without a registered factory,
 * the renderer iterates raw graphemes and uses the bundle's char-keyed
 * `glyphData` map. Use `tegaki/shaper-harfbuzz` for fonts that need complex
 * shaping (ligatures, contextual forms, Arabic/Indic scripts).
 *
 * Re-registering replaces the previous factory and invalidates the shaper
 * cache. Pass `null` to unregister.
 */
export function registerShaper(f: ShaperFactory | null): void {
  factory = f;
  shaperCache.clear();
}

/**
 * Build (or reuse) a shaper for a bundle. Returns `null` when no factory is
 * registered or the factory declined this bundle.
 */
export function getShaperForBundle(bundle: TegakiBundle): Promise<BundleShaper> | null {
  if (!factory) return null;
  const key = bundle.fontUrl;
  let entry = shaperCache.get(key);
  if (!entry) {
    const result = factory(bundle);
    if (!result) return null;
    shaperCache.set(key, result);
    entry = result;
  }
  return entry;
}
