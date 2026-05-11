export interface EdgeContext {
  request: Request;
  env?: Record<string, string>;
  platform?: 'cloudflare' | 'deno' | 'bun' | 'node' | 'unknown';
}

export interface EdgeRenderOptions {
  html: string;
  stateScript?: string;
  headers?: Record<string, string>;
  status?: number;
}

export function detectPlatform(): EdgeContext['platform'] {
  // Check for Deno
  if (typeof (globalThis as Record<string, unknown>)['Deno'] !== 'undefined') {
    return 'deno';
  }
  // Check for Bun
  if (typeof (globalThis as Record<string, unknown>)['Bun'] !== 'undefined') {
    return 'bun';
  }
  // Check for Cloudflare Workers via navigator.userAgent
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('Cloudflare-Workers')
  ) {
    return 'cloudflare';
  }
  // Check for Node.js
  if (typeof process !== 'undefined') {
    const versions = (process as unknown as Record<string, unknown>)['versions'];
    if (typeof versions === 'object' && versions !== null && 'node' in versions) {
      return 'node';
    }
  }
  return 'unknown';
}

export function createEdgeHandler(
  renderFn: (ctx: EdgeContext) => Promise<EdgeRenderOptions> | EdgeRenderOptions,
): (request: Request, env?: Record<string, string>) => Promise<Response> {
  return async (request: Request, env?: Record<string, string>): Promise<Response> => {
    const platform = detectPlatform() ?? 'unknown';
    const ctx: EdgeContext = { request, platform };
    if (env !== undefined) ctx.env = env;

    const rendered = await renderFn(ctx);

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'text/html',
      'X-Powered-By': 'Drishti',
    };

    const finalHeaders = mergeHeaders(defaultHeaders, rendered.headers ?? {});
    const status = rendered.status ?? 200;

    let body = rendered.html;
    if (rendered.stateScript) {
      body = injectState(body, { __script: rendered.stateScript });
    }

    return new Response(body, {
      status,
      headers: finalHeaders,
    });
  };
}

export function injectState(html: string, state: Record<string, unknown>): string {
  const json = JSON.stringify(state);
  const script = `<script>window.__DRISHTI_STATE__ = ${json};</script>`;
  const closeBody = '</body>';
  const idx = html.lastIndexOf(closeBody);
  if (idx === -1) {
    return html + script;
  }
  return html.slice(0, idx) + script + html.slice(idx);
}

export function mergeHeaders(
  base: Record<string, string>,
  override: Record<string, string>,
): Record<string, string> {
  return { ...base, ...override };
}
