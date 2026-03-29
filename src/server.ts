import { serve } from 'bun';
import homepage from '../public/index.html';

const server = serve({
  routes: {
    '/': homepage,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Listening on ${server.url}`);
