---
"tegaki": patch
---

Introduces TegakiQuality ({ pixelRatio, segmentSize }) on the engine
options, replacing the top-level segmentSize. pixelRatio multiplies
devicePixelRatio when sizing the canvas backing store and root
transform, letting the browser downsample to the displayed size for
higher-quality antialiasing at a quadratic cost in pixels filled.
segmentSize retains its prior meaning under the new namespace.
