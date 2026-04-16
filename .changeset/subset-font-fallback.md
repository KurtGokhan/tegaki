---
"tegaki": minor
---

Add subset font bundling with full-font fallback. Bundles generated from a character subset now ship two font files: a subsetted TTF for the generated glyphs and the full TTF as a CSS fallback. The subset font is registered under a scoped family name (`<family> Tegaki <hash>`) to avoid colliding with user-loaded fonts, while the full font uses the original family name. The renderer composes both in `font-family` so the browser automatically falls back to the full font for non-generated characters.

New `TegakiBundle` fields: `fullFamily`, `fullFontUrl`. Existing bundles without these fields continue to work unchanged.
