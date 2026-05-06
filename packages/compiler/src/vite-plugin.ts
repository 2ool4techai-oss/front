import { compile } from './index.js';

export interface DrishtiPluginOptions {
  runtime?: string;
}

export function drishtiPlugin(opts: DrishtiPluginOptions = {}) {
  return {
    name: 'vite-plugin-drishti',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.endsWith('.dr')) return null;
      const result = compile(code, { ...(opts.runtime ? { runtime: opts.runtime } : {}), filename: id });
      if (result.errors.length) {
        throw new Error(result.errors.join('\n'));
      }
      return { code: result.code, map: null };
    },
  };
}
