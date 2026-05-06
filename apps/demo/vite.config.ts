import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@drishti/runtime': resolve(__dirname, '../../packages/runtime/src/index.ts'),
      '@drishti/components': resolve(__dirname, '../../packages/components/src/index.ts'),
      '@drishti/compiler': resolve(__dirname, '../../packages/compiler/src/index.ts'),
    },
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
