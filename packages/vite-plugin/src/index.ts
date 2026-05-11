import { transformDrFile } from './transform.js';

export interface DrishtiPluginOptions {
  include?: string[];  // glob patterns, default ['**/*.dr']
  devtools?: boolean;  // inject devtools bridge, default false
}

export function drishti(opts?: DrishtiPluginOptions): import('vite').Plugin {
  void opts; // options reserved for future use
  return {
    name: 'vite-plugin-drishti',
    enforce: 'pre' as const,

    transform(code: string, id: string) {
      if (!id.endsWith('.dr')) return null;

      try {
        const result = transformDrFile(code, id);
        return { code: result, map: null };
      } catch (err) {
        this.error(
          `Failed to transform ${id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },

    handleHotUpdate(ctx: { file: string; server: { ws: { send: (msg: unknown) => void } } }) {
      if (!ctx.file.endsWith('.dr')) return;
      ctx.server.ws.send({ type: 'full-reload', path: ctx.file });
    },
  };
}

// Named export for explicit import
export { transformDrFile } from './transform.js';
export { parseDrFile } from './parser.js';
export { compileTemplate } from './template-compiler.js';
export type { DrBlock } from './parser.js';
