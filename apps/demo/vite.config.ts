import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@drishti/runtime':    resolve(__dirname, '../../packages/runtime/src/index.ts'),
      '@drishti/components': resolve(__dirname, '../../packages/components/src/index.ts'),
      '@drishti/compiler':   resolve(__dirname, '../../packages/compiler/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    open: false,
    watch: {
      // Don't watch tsconfig files in workspace packages — prevents restart loop
      ignored: [
        '**/packages/*/tsconfig.json',
        '**/packages/*/dist/**',
        '**/node_modules/**',
      ],
    },
  },
  optimizeDeps: {
    // Pre-bundle workspace source so Vite doesn't re-process on every save
    include: [],
    exclude: ['@drishti/runtime', '@drishti/components', '@drishti/compiler'],
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
