import { signal } from './signal.js';
import type { Signal } from './types.js';

// ── D1 Database Signal ─────────────────────────────────────────────────

export interface D1SignalOptions<T> {
  parse?:           (rows: unknown[]) => T;
  refetchInterval?: number;
  onError?:         (err: unknown) => void;
}

export interface D1SignalHandle<T> {
  readonly data:    Signal<T | undefined>;
  readonly loading: Signal<boolean>;
  readonly error:   Signal<unknown>;
  execute(query: string, params?: unknown[]): Promise<void>;
  refetch(): Promise<void>;
  destroy(): void;
}

export interface D1Database {
  prepare(query: string): {
    bind(...params: unknown[]): {
      all<T = unknown>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean }>;
    };
  };
}

export function createD1Signal<T = unknown[]>(
  db: D1Database,
  query: string,
  opts?: D1SignalOptions<T>,
): D1SignalHandle<T> {
  const data    = signal<T | undefined>(undefined);
  const loading = signal<boolean>(false);
  const error   = signal<unknown>(undefined);

  let _currentQuery = query;
  let _currentParams: unknown[] = [];
  let _intervalId: ReturnType<typeof setInterval> | null = null;
  let _destroyed = false;

  async function runQuery(q: string, params: unknown[]): Promise<void> {
    if (_destroyed) return;
    loading.set(true);
    error.set(undefined);
    try {
      const bound = db.prepare(q).bind(...params);
      const result = await bound.all<unknown>();
      if (_destroyed) return;
      const parsed = opts?.parse
        ? opts.parse(result.results)
        : (result.results as unknown as T);
      data.set(parsed);
    } catch (err) {
      if (_destroyed) return;
      error.set(err);
      opts?.onError?.(err);
    } finally {
      if (!_destroyed) loading.set(false);
    }
  }

  if (opts?.refetchInterval != null && opts.refetchInterval > 0) {
    _intervalId = setInterval(() => {
      void runQuery(_currentQuery, _currentParams);
    }, opts.refetchInterval);
  }

  return {
    data,
    loading,
    error,

    async execute(q: string, params: unknown[] = []): Promise<void> {
      _currentQuery = q;
      _currentParams = params;
      await runQuery(q, params);
    },

    async refetch(): Promise<void> {
      await runQuery(_currentQuery, _currentParams);
    },

    destroy(): void {
      _destroyed = true;
      if (_intervalId !== null) {
        clearInterval(_intervalId);
        _intervalId = null;
      }
    },
  };
}

// ── KV Signal ──────────────────────────────────────────────────────────

export interface KVSignalOptions<T> {
  parse?:     (raw: string | null) => T | undefined;
  serialize?: (val: T) => string;
  ttl?:       number;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface KVSignalHandle<T> {
  readonly value:  Signal<T | undefined>;
  readonly synced: Signal<boolean>;
  load(key: string): Promise<void>;
  save(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createKVSignal<T>(
  kv: KVNamespace,
  opts?: KVSignalOptions<T>,
): KVSignalHandle<T> {
  const value  = signal<T | undefined>(undefined);
  const synced = signal<boolean>(false);

  function defaultParse(raw: string | null): T | undefined {
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  function defaultSerialize(val: T): string {
    return JSON.stringify(val);
  }

  const parse     = opts?.parse     ?? defaultParse;
  const serialize = opts?.serialize ?? defaultSerialize;

  return {
    value,
    synced,

    async load(key: string): Promise<void> {
      synced.set(false);
      const raw = await kv.get(key);
      value.set(parse(raw));
      synced.set(true);
    },

    async save(key: string, val: T): Promise<void> {
      synced.set(false);
      const putOpts: { expirationTtl?: number } | undefined =
        opts?.ttl != null ? { expirationTtl: opts.ttl } : undefined;
      if (putOpts !== undefined) {
        await kv.put(key, serialize(val), putOpts);
      } else {
        await kv.put(key, serialize(val));
      }
      value.set(val);
      synced.set(true);
    },

    async remove(key: string): Promise<void> {
      synced.set(false);
      await kv.delete(key);
      value.set(undefined);
      synced.set(true);
    },
  };
}
