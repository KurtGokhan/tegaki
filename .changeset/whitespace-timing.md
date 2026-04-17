---
"tegaki": patch
---

Fix timing around whitespace characters. Spaces and line breaks no longer consume `unknownDuration` on top of `wordGap`/`lineGap` — the gap alone now represents the full pause. `\r\n` and `\r` are normalized to `\n`, and all Unicode whitespace (NBSP, tab, ideographic space, etc.) is treated as a word gap.

Fixes [#28](https://github.com/KurtGokhan/tegaki/issues/28)
