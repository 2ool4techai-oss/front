import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@nexoraaidrishti/runtime': resolve(__dirname, '../runtime/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
