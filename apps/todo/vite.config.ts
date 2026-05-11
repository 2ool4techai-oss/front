import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@drishti/runtime': '/node_modules/@drishti/runtime/dist/index.js' }
  }
});
