import { signal } from './signal.js';
import { sanitizeObject } from './security.js';
import type { Signal } from './types.js';

export type ConnectorStatus = 'idle' | 'loading' | 'ready' | 'error' | 'offline';

export interface ConnectorState<T> {
  data: Signal<T | null>;
  status: Signal<ConnectorStatus>;
  error: Signal<string | null>;
  refresh: () => Promise<void>;
  destroy: () => void;
}

interface ConnectOptions {
  headers?: Record<string, string>;
  transform?: (raw: unknown) => unknown;
  fallback?: unknown;
  pollMs?: number;
}

const MAX_RETRIES = 3;
const BASE_BACKOFF = 500;

async function fetchWithRetry(url: string, opts: RequestInit, attempt = 0): Promise<Response> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res;
  } catch (e) {
    if (attempt >= MAX_RETRIES) throw e;
    await new Promise(r => setTimeout(r, BASE_BACKOFF * Math.pow(2, attempt)));
    return fetchWithRetry(url, opts, attempt + 1);
  }
}

export function connectREST<T = unknown>(
  url: string,
  opts: ConnectOptions = {},
): ConnectorState<T> {
  const data = signal<T | null>(null);
  const status = signal<ConnectorStatus>('idle');
  const error = signal<string | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let aborted = false;

  const load = async () => {
    if (aborted) return;
    status.set('loading');
    error.set(null);
    try {
      const res = await fetchWithRetry(url, {
        headers: { 'Accept': 'application/json', ...(opts.headers ?? {}) },
        signal: AbortSignal.timeout(10_000),
      });
      const raw = await res.json() as unknown;
      const transformed = opts.transform ? opts.transform(raw) : raw;
      data.set(sanitizeObject(transformed as Record<string, unknown>) as T);
      status.set('ready');
    } catch (e) {
      if (aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      error.set(msg);
      status.set(navigator.onLine ? 'error' : 'offline');
      if (opts.fallback !== undefined) data.set(opts.fallback as T);
    }
  };

  load();

  if (opts.pollMs && opts.pollMs > 0) {
    pollTimer = setInterval(load, opts.pollMs);
  }

  return {
    data,
    status,
    error,
    refresh: load,
    destroy: () => {
      aborted = true;
      if (pollTimer) clearInterval(pollTimer);
    },
  };
}

export function connectWS<T = unknown>(
  url: string,
  opts: ConnectOptions = {},
): ConnectorState<T> {
  const data = signal<T | null>(null);
  const status = signal<ConnectorStatus>('idle');
  const error = signal<string | null>(null);
  let ws: WebSocket | null = null;
  let aborted = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const connect = () => {
    if (aborted) return;
    status.set('loading');
    ws = new WebSocket(url);

    ws.onopen = () => {
      status.set('ready');
      attempt = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data as string) as unknown;
        const transformed = opts.transform ? opts.transform(raw) : raw;
        data.set(sanitizeObject(transformed as Record<string, unknown>) as T);
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      error.set('WebSocket connection error');
      status.set('error');
    };

    ws.onclose = () => {
      if (aborted) return;
      status.set('error');
      const backoff = Math.min(BASE_BACKOFF * Math.pow(2, attempt++), 30_000);
      reconnectTimer = setTimeout(connect, backoff);
    };
  };

  connect();

  return {
    data,
    status,
    error,
    refresh: () => { ws?.close(); connect(); return Promise.resolve(); },
    destroy: () => {
      aborted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}

export function connectSSE<T = unknown>(
  url: string,
  opts: ConnectOptions = {},
): ConnectorState<T> {
  const data = signal<T | null>(null);
  const status = signal<ConnectorStatus>('loading');
  const error = signal<string | null>(null);
  let es: EventSource | null = null;
  let aborted = false;

  const connect = () => {
    es = new EventSource(url);

    es.onopen = () => status.set('ready');

    es.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data as string) as unknown;
        const transformed = opts.transform ? opts.transform(raw) : raw;
        data.set(sanitizeObject(transformed as Record<string, unknown>) as T);
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      if (!aborted) { error.set('SSE connection error'); status.set('error'); }
    };
  };

  connect();

  return {
    data,
    status,
    error,
    refresh: () => { es?.close(); connect(); return Promise.resolve(); },
    destroy: () => { aborted = true; es?.close(); },
  };
}

export function connect<T = unknown>(source: string, opts: ConnectOptions = {}): ConnectorState<T> {
  if (source.startsWith('ws://') || source.startsWith('wss://')) {
    return connectWS<T>(source, opts);
  }
  if (source.startsWith('sse:')) {
    return connectSSE<T>(source.slice(4), opts);
  }
  return connectREST<T>(source, opts);
}
