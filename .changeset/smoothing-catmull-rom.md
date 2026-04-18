---
'tegaki': minor
---

Add `quality.smoothing` option that interpolates stroke points with a centripetal Catmull-Rom spline, hiding the faceted corners visible at large render sizes where the baked polyline resolution shows through. Enabling it forces subdivision on (default `segmentSize=2` CSS px) and rebuilds the subdivision cache; the original points stay on the curve, so animation timing and wobble phase are unchanged. Default is `false` (existing bundles render identically). Also exposed on the web component as the `smoothing` attribute.
