<img src="media/tegaki.svg" alt="Tegaki" width="128" align="right" />

# Tegaki

**Handwriting animation for any font**

Tegaki (手書き) turns any Google Font into animated handwriting.
No manual path authoring. No native dependencies. Just pick a font.

[![npm](https://img.shields.io/npm/v/tegaki)](https://www.npmjs.com/package/tegaki)
[![license](https://img.shields.io/npm/l/tegaki)](https://github.com/KurtGokhan/tegaki/blob/main/LICENSE)

<br clear="both" />

<p align="center">
  <img src="media/hello-world.svg" alt="Hello World handwriting animation" width="500" />
</p>

---

## Quick Start

**1. Install**

```bash
npm install tegaki
```

**2. Use** (React example)

```tsx
import { TegakiRenderer } from 'tegaki';
import caveat from 'tegaki/fonts/caveat';

function App() {
  return (
    <TegakiRenderer font={caveat} style={{ fontSize: '48px' }}>
      Hello World
    </TegakiRenderer>
  );
}
```

That's it. The text draws itself stroke by stroke with natural timing.

## Framework Support

Tegaki works with all major frameworks:

```tsx
import { TegakiRenderer } from 'tegaki/react';   // React
import { TegakiRenderer } from 'tegaki/svelte';  // Svelte
import { TegakiRenderer } from 'tegaki/vue';     // Vue
import { TegakiRenderer } from 'tegaki/solid';   // SolidJS
```

```astro
---
import TegakiRenderer from 'tegaki/astro';       // Astro
---
```

```ts
import { TegakiEngine } from 'tegaki/core';      // Vanilla JS
```

## Built-in Fonts

Four handwriting fonts are bundled and ready to use:

- **Caveat** — `tegaki/fonts/caveat`
- **Italianno** — `tegaki/fonts/italianno`
- **Tangerine** — `tegaki/fonts/tangerine`
- **Parisienne** — `tegaki/fonts/parisienne`

For other Google Fonts, use the [interactive generator](https://gkurt.com/tegaki/generator/) to create a custom bundle.

## Documentation

Visit **[gkurt.com/tegaki](https://gkurt.com/tegaki)** for full documentation:

- [Getting Started](https://gkurt.com/tegaki/getting-started/)
- [Framework Guides](https://gkurt.com/tegaki/frameworks/react/) (React, Svelte, Vue, SolidJS, Astro, Vanilla)
- [Generating Fonts](https://gkurt.com/tegaki/guides/generating-fonts/)
- [API Reference](https://gkurt.com/tegaki/api/tegaki-renderer/)

## License

[MIT](LICENSE)
