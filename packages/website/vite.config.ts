import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: ['tegaki@dev'],
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        chat: 'chat.html',
      },
    },
  },
});
