import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import starlightThemeNova from 'starlight-theme-nova';

export default defineConfig({
  site: 'https://gkurt.com',
  base: '/tegaki',
  integrations: [
    starlight({
      title: 'Tegaki',
      description: 'Animated handwriting from any Google Font. Generate stroke data, render beautiful writing animations in React.',
      logo: { src: './src/assets/tegaki.svg', alt: 'Tegaki logo' },
      head: [{ tag: 'meta', attrs: { property: 'og:image', content: '/tegaki/tegaki-card.png' } }],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/KurtGokhan/tegaki' },
        { icon: 'twitter', label: 'Twitter', href: 'https://twitter.com/gkurttech' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/tegaki' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started' },
            { label: 'Installation', slug: 'installation' },
            { label: 'Quick Start', slug: 'quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Generating Font Data', slug: 'guides/generating' },
            { label: 'Rendering Animations', slug: 'guides/rendering' },
            { label: 'Streaming Text', slug: 'guides/streaming' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'TegakiRenderer', slug: 'api/renderer' },
            { label: 'Generator CLI', slug: 'api/generator' },
          ],
        },
        {
          label: 'Demos',
          items: [{ label: 'Generator', link: '/generator/' }],
        },
      ],
      customCss: ['./src/styles/global.css'],
      plugins: [starlightThemeNova({ stylingSystem: 'tailwind' })],
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      external: ['tegaki'],
      conditions: ['tegaki@dev'],
      externalConditions: ['tegaki@dev'],
    },
    build: {
      rollupOptions: {
        external: [/^node:/, 'bun'],
      },
    },
    ssr: {
      resolve: {
        conditions: ['tegaki@dev'],
        externalConditions: ['tegaki@dev'],
      },
    },
  },
});
