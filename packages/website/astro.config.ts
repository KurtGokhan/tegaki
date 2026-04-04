import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Tegaki',
      description: 'Animated handwriting from any Google Font. Generate stroke data, render beautiful writing animations in React.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/KurtGokhan/tegaki' }],
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
          items: [
            { label: 'Generator', link: '/generator/' },
            { label: 'Chat Demo', link: '/chat/' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      conditions: ['tegaki@dev'],
    },
    build: {
      rollupOptions: {
        external: ['bun', 'node:path'],
      },
    },
  },
});
