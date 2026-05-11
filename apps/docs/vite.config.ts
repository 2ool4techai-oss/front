import { defineConfig } from 'vite';
export default defineConfig({
  resolve: {
    alias: {
      '@drishti/runtime': new URL('../../packages/runtime/src/index.ts', import.meta.url).pathname,
      '@drishti/components': new URL('../../packages/components/src/index.ts', import.meta.url).pathname,
    }
  }
});
