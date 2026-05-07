import { compile } from './index.js';

export interface DrishtiPluginOptions {
  runtime?: string;
  target?:  'js' | 'ts';   // default 'js' — emit ESM directly, no TypeScript step
}

export function drishtiPlugin(opts: DrishtiPluginOptions = {}) {
  return {
    name:    'vite-plugin-drishti',
    enforce: 'pre' as const,

    resolveId(id: string) {
      if (id.endsWith('.dr')) return id;
      return null;
    },

    transform(code: string, id: string) {
      if (!id.endsWith('.dr')) return null;

      const result = compile(code, {
        ...(opts.runtime ? { runtime: opts.runtime } : {}),
        target:   opts.target ?? 'js',
        filename: id,
      });

      if (result.errors.length) {
        throw new Error(`[DRISHTI] Compile error in ${id}:\n${result.errors.join('\n')}`);
      }

      result.warnings.forEach(w => console.warn(`[DRISHTI] ${w}`));
      return { code: result.code, map: null };
    },
  };
}
