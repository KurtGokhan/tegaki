<p align="center">
  <img src="media/tegaki-card.png" alt="Tegaki" width="640" />
</p>

<h3 align="center">Handwriting animation for any font</h3>

<p align="center">
  Tegaki (手書き) turns any Google Font into animated handwriting.<br />
  No manual path authoring. No native dependencies. Just pick a font.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/tegaki"><img src="https://img.shields.io/npm/v/tegaki" alt="npm" /></a>
  <a href="https://github.com/KurtGokhan/tegaki/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/tegaki" alt="license" /></a>
</p>

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

- [Getting Started](https://gkurt.com/tegaki/docs/getting-started/)
- [Framework Guides](https://gkurt.com/tegaki/docs/frameworks/react/) (React, Svelte, Vue, SolidJS, Astro, Vanilla)
- [Generating Fonts](https://gkurt.com/tegaki/docs/guides/generating-fonts/)
- [API Reference](https://gkurt.com/tegaki/docs/api/tegaki-renderer/)

## License

[MIT](LICENSE)
