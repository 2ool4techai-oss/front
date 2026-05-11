import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@drishti/runtime': resolve(__dirname, '../runtime/src/index.ts'),
    },
  },
});
