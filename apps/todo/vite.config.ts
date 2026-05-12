import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@nexoraaidrishti/runtime': '/node_modules/@nexoraaidrishti/runtime/dist/index.js' }
  }
});
