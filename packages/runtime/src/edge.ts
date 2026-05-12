import { signal, effect } from './signal.js';
import type { Signal } from './types.js';

// ── EdgeSignal Types ───────────────────────────────────────────────────

export interface EdgeSignalOptions<T> {
  key: string;
  region?: string;
  ttl?: number;           // cache TTL in seconds
  fallback?: T;
}

export interface EdgeSignalType<T> extends Signal<T> {
  readonly key: string;
  readonly region: string | undefined;
  rehydrate: (serverValue: T) => void;
  invalidate: () => void;
}

// ── isEdgeContext ──────────────────────────────────────────────────────

export function isEdgeContext(): boolean {
  // We're in an edge context if there's no browser DOM
  // and we are running in one of the recognised edge runtimes
  if (typeof document !== 'undefined') return false;
  const platform = detectPlatform();
  return platform === 'cloudflare' || platform === 'deno' || platform === 'bun';
}

// ── getEdgeRegion ──────────────────────────────────────────────────────

export function getEdgeRegion(): string | null {
  if (typeof (globalThis as Record<string, unknown>)['__DRISHTI_EDGE_REGION__'] === 'string') {
    return (globalThis as Record<string, unknown>)['__DRISHTI_EDGE_REGION__'] as string;
  }
  // Cloudflare Workers expose CF-Region in the request; here we read the global hint
  if (typeof (globalThis as Record<string, unknown>)['CF_REGION'] === 'string') {
    return (globalThis as Record<string, unknown>)['CF_REGION'] as string;
  }
  return null;
}

// ── edgeSignal ─────────────────────────────────────────────────────────

/**
 * A signal whose initial value can be provided by the CDN edge during SSR.
 * Falls back to the `initial` value when running in a pure browser context
 * or when the edge is unavailable.  The signal is rehydrated on the client
 * via a `<script>` injected by the edge renderer.
 */
export function edgeSignal<T>(initial: T, opts: EdgeSignalOptions<T>): EdgeSignalType<T> {
  const fallback = opts.fallback !== undefined ? opts.fallback : initial;

  // On the client, look for server-injected state first
  let startValue: T = initial;

  if (typeof window !== 'undefined') {
    const stateMap = (window as unknown as Record<string, unknown>)['__DRISHTI_EDGE_SIGNALS__'] as
      | Record<string, unknown>
      | undefined;
    if (stateMap && opts.key in stateMap) {
      startValue = stateMap[opts.key] as T;
    }
  }

  const _sig = signal<T>(startValue);
  let _cacheExpiry: number | null = null;

  if (opts.ttl !== undefined) {
    _cacheExpiry = Date.now() + opts.ttl * 1000;
  }

  // Persist to edge state registry if window exists (client rehydration map)
  if (typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    if (!win['__DRISHTI_EDGE_SIGNALS__']) win['__DRISHTI_EDGE_SIGNALS__'] = {};
    (win['__DRISHTI_EDGE_SIGNALS__'] as Record<string, unknown>)[opts.key] = startValue;
    effect(() => {
      const v = _sig();
      (win['__DRISHTI_EDGE_SIGNALS__'] as Record<string, unknown>)[opts.key] = v;
    });
  }

  const edgeSig = Object.assign(
    function (): T {
      // Check TTL expiry — return fallback if expired
      if (_cacheExpiry !== null && Date.now() > _cacheExpiry) {
        return fallback;
      }
      return _sig();
    },
    {
      set: (value: T) => _sig.set(value),
      peek: () => _sig.peek(),
      subscribe: (fn: (value: T) => void) => _sig.subscribe(fn),
      key: opts.key,
      region: opts.region,
      rehydrate(serverValue: T): void {
        // Called on the client once the server-rendered state arrives
        _cacheExpiry = opts.ttl !== undefined ? Date.now() + opts.ttl * 1000 : null;
        _sig.set(serverValue);
      },
      invalidate(): void {
        _cacheExpiry = 0; // force expired
        _sig.set(fallback);
      },
    },
  ) as EdgeSignalType<T>;

  return edgeSig;
}

// ── Original edge types ────────────────────────────────────────────────

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
