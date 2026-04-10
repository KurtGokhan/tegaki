---
'tegaki': minor
---

Add CDN-friendly font bundles and `createBundle` helper

- Built font bundles now use `new URL(..., import.meta.url)` instead of bundler-specific import attributes, making them work natively in browsers and on CDN services like esm.sh and jsDelivr
- Glyph data JSON is inlined in the built output so no import attributes are needed at runtime
- Added `createBundle()` to `tegaki/core` and `tegaki/wc` for manually assembling a font bundle from fetched glyph data and a font URL
