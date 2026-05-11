import { signal } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type ServerSignalStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ServerSignalState<T> {
  data:      T | undefined;
  error:     unknown;
  status:    ServerSignalStatus;
  updatedAt: number | null;
}

export interface ServerSignalOptions<T> {
  initialData?: T;
  /** Auto-refresh interval in ms. 0 = disabled. */
  refetchInterval?: number;
  /** Called after each successful fetch. */
  onSuccess?: (data: T) => void;
  /** Called on fetch error. */
  onError?: (err: unknown) => void;
  /** Retry count on error. Default 0. */
  retry?: number;
}

export interface ServerSignalHandle<T> {
  readonly signal: Signal<ServerSignalState<T>>;
  fetch():   Promise<void>;
  setData(data: T): void;
  invalidate(): void;
  destroy(): void;
}

// ── createServerSignal ─────────────────────────────────────────────────

export function createServerSignal<T>(
  fetcher: () => Promise<T>,
  opts: ServerSignalOptions<T> = {},
): ServerSignalHandle<T> {
  const { initialData, refetchInterval = 0, onSuccess, onError, retry = 0 } = opts;

  const _state = signal<ServerSignalState<T>>({
    data:      initialData,
    error:     undefined,
    status:    initialData !== undefined ? 'success' : 'idle',
    updatedAt: initialData !== undefined ? Date.now() : null,
  });

  let _timer: ReturnType<typeof setInterval> | null = null;
  let _destroyed = false;
  let _abortCtrl: AbortController | null = null;

  async function runFetch(attemptsLeft: number): Promise<void> {
    if (_destroyed) return;
    _state.set({ ..._state.peek(), status: 'loading', error: undefined });

    try {
      _abortCtrl = new AbortController();
      const data = await fetcher();
      if (_destroyed) return;
      _state.set({ data, error: undefined, status: 'success', updatedAt: Date.now() });
      onSuccess?.(data);
    } catch (err) {
      if (_destroyed) return;
      if (attemptsLeft > 0) {
        await runFetch(attemptsLeft - 1);
        return;
      }
      _state.set({ ..._state.peek(), error: err, status: 'error' });
      onError?.(err);
    } finally {
      _abortCtrl = null;
    }
  }

  function startInterval(): void {
    if (refetchInterval > 0 && !_timer) {
      _timer = setInterval(() => { void runFetch(retry); }, refetchInterval);
    }
  }

  function stopInterval(): void {
    if (_timer !== null) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  const handle: ServerSignalHandle<T> = {
    signal: _state,

    async fetch(): Promise<void> {
      await runFetch(retry);
      startInterval();
    },

    setData(data: T): void {
      _state.set({ data, error: undefined, status: 'success', updatedAt: Date.now() });
    },

    invalidate(): void {
      _state.set({ ..._state.peek(), status: 'idle' });
    },

    destroy(): void {
      _destroyed = true;
      stopInterval();
      _abortCtrl?.abort();
    },
  };

  return handle;
}

// ── createSSESignal ────────────────────────────────────────────────────
// Server-Sent Events backed signal — streams updates from a URL.

export interface SSESignalOptions<T> {
  parse?:     (raw: string) => T;
  onError?:   (err: Event) => void;
  reconnect?: boolean;
  reconnectDelay?: number;
}

export interface SSESignalHandle<T> {
  readonly signal: Signal<T | undefined>;
  destroy(): void;
}

export function createSSESignal<T>(
  url: string,
  opts: SSESignalOptions<T> = {},
): SSESignalHandle<T> {
  const {
    parse = (r: string) => JSON.parse(r) as T,
    onError,
    reconnect = true,
    reconnectDelay = 3000,
  } = opts;

  const _data = signal<T | undefined>(undefined);
  let _es: EventSource | null = null;
  let _destroyed = false;
  let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (_destroyed || typeof EventSource === 'undefined') return;
    _es = new EventSource(url);

    _es.onmessage = (ev) => {
      if (_destroyed) return;
      try {
        _data.set(parse(ev.data as string));
      } catch { /* malformed — skip */ }
    };

    _es.onerror = (ev) => {
      onError?.(ev);
      _es?.close();
      _es = null;
      if (reconnect && !_destroyed) {
        _reconnectTimer = setTimeout(connect, reconnectDelay);
      }
    };
  }

  connect();

  return {
    signal: _data,
    destroy(): void {
      _destroyed = true;
      if (_reconnectTimer !== null) clearTimeout(_reconnectTimer);
      _es?.close();
      _es = null;
    },
  };
}
