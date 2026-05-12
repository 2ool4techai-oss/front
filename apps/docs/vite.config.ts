import { defineConfig } from 'vite';
export default defineConfig({
  resolve: {
    alias: {
      '@nexoraaidrishti/runtime': new URL('../../packages/runtime/src/index.ts', import.meta.url).pathname,
      '@nexoraaidrishti/components': new URL('../../packages/components/src/index.ts', import.meta.url).pathname,
    }
  }
});
