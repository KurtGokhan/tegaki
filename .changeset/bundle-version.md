---
"tegaki": minor
---

Add bundle format versioning. Generated bundles now include a `version` field (currently `0`) so the engine can detect incompatible bundles. The engine checks the version when a bundle is registered or resolved and logs a console warning (once per bundle) if the version is missing or unsupported.

New exports: `BUNDLE_VERSION`, `COMPATIBLE_BUNDLE_VERSIONS`. New optional `TegakiBundle` field: `version`. Existing bundles without a version field trigger the warning but continue to work.
