import { serve } from 'bun';
import previewPage from '../public/preview.html';

export function serveTegakiWeb() {
  const server = serve({
    routes: {
      '/': previewPage,
    },
    development: {
      hmr: true,
      console: true,
    },
  });

  console.log(`Listening on ${server.url}`);
}

if (import.meta.main) serveTegakiWeb();
