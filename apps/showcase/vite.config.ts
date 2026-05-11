import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@drishti/runtime':    resolve(__dirname, '../../packages/runtime/src/index.ts'),
      '@drishti/components': resolve(__dirname, '../../packages/components/src/index.ts'),
    },
  },
  server: {
    port: 5175,
    open: false,
    watch: {
      ignored: [
        '**/packages/*/tsconfig.json',
        '**/packages/*/dist/**',
        '**/node_modules/**',
      ],
    },
  },
  optimizeDeps: {
    include: [],
    exclude: ['@drishti/runtime', '@drishti/components'],
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
