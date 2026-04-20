---
'tegaki': minor
---

Split `gradient` into `strokeGradient` + `globalGradient`, and add render-stage hooks for layout-spanning effects. Closes #26.

**Breaking**

The `gradient` effect is renamed to `strokeGradient` with unchanged behavior (each stroke independently maps its progress to the color stops; `colors: 'rainbow'` still works). Rename the key in your `effects` prop:

```tsx
// before
effects={{ gradient: { colors: ['#f00', '#00f'] } }}
// after
effects={{ strokeGradient: { colors: ['#f00', '#00f'] } }}
```

**New — `globalGradient`**

A canvas-space linear gradient that spans the full text bounding box — the leftmost pixel of the first glyph is `colors[0]` and the rightmost pixel of the last glyph is `colors[N]`, regardless of stroke boundaries. Matches CSS `background-clip: text` semantics.

```tsx
effects={{
  globalGradient: {
    colors: ['#f00', '#00f'],
    angle: 0, // 0 = left→right (default); 90 = top→bottom; positive = clockwise
  },
}}
```

`strokeGradient` and `globalGradient` can be enabled independently. If both are on, `strokeGradient` wins per segment (its per-stroke color overrides `globalGradient`'s canvas-wide paint); this combination is unusual but predictable.

**New — effect render-stage hooks**

Effects can now declare optional `beforeRender(stage, config)` / `afterRender(stage, config)` hooks on their `EffectDefinition` metadata. The stage context exposes the 2D context, the `TextLayout`, a pre-computed `LayoutBBox`, base color, and seed. Hooks run once around the glyph loop (before in forward order, after in reverse), so effects spanning the whole layout — like `globalGradient` — have a natural place to set up canvas state. Built-in per-stroke effects (`glow`, `wobble`, `pressureWidth`, `taper`, `strokeGradient`) declare no hooks and are unaffected.

**New public exports from `tegaki/core`**: `EffectDefinition`, `RenderStageContext`, `LayoutBBox`, `getEffectDefinition`, `hasRenderHooks`, `computeLayoutBbox`, plus the previously-private `findEffect` / `findEffects`.
