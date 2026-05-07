import { signal, computed, effect, batch, untrack } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error' | 'refreshing';

export interface QueryOptions<T> {
  /** Cache key — derived from the endpoint if omitted */
  key?:             string | (() => string);
  /** ms before data is considered stale. Default: 30_000 */
  staleTime?:       number;
  /** ms to keep cached data after all subscribers unmount. Default: 300_000 */
  gcTime?:          number;
  /** Refetch when window regains focus. Default: true */
  refetchOnFocus?:  boolean;
  /** Poll interval in ms. 0 = disabled. Default: 0 */
  refetchInterval?: number;
  /** Initial data (skips first fetch) */
  initialData?:     T;
  /** Transform the raw response */
  select?:          (raw: unknown) => T;
  /** Called on success */
  onSuccess?:       (data: T) => void;
  /** Called on error */
  onError?:         (err: Error) => void;
  /** Retry count on failure. Default: 2 */
  retry?:           number;
  /** Whether to run this query. Default: true */
  enabled?:         boolean | Signal<boolean>;
}

export interface QueryResult<T> {
  readonly data:    Signal<T | undefined>;
  readonly error:   Signal<Error | null>;
  readonly status:  Signal<QueryStatus>;
  readonly loading: ComputedSignal<boolean>;
  readonly stale:   ComputedSignal<boolean>;
  /** Manually trigger a refetch */
  refetch(): Promise<void>;
  /** Optimistically update data; returns rollback function */
  optimisticUpdate(updater: (prev: T | undefined) => T): () => void;
  /** Invalidate (mark stale + refetch) */
  invalidate(): void;
  /** Unsubscribe and clean up */
  destroy(): void;
}

export interface MutationOptions<TInput, TOutput> {
  /** Called before mutation — return context for onError rollback */
  onMutate?:   (input: TInput) => unknown;
  /** Called on success; can invalidate queries by key */
  onSuccess?:  (data: TOutput, input: TInput, ctx: unknown) => void | Promise<void>;
  /** Called on error with context from onMutate */
  onError?:    (err: Error, input: TInput, ctx: unknown) => void;
  /** Always called */
  onSettled?:  (data: TOutput | undefined, err: Error | null, input: TInput) => void;
  /** Query keys to invalidate after success */
  invalidates?: string[];
}

export interface MutationResult<TInput, TOutput> {
  readonly loading: Signal<boolean>;
  readonly error:   Signal<Error | null>;
  readonly data:    Signal<TOutput | undefined>;
  readonly status:  Signal<'idle' | 'loading' | 'success' | 'error'>;
  mutate(input: TInput): Promise<TOutput>;
  reset(): void;
}

// ── Cache (module-level singleton) ────────────────────────────────────

interface CacheEntry<T = unknown> {
  data:        T | undefined;
  error:       Error | null;
  fetchedAt:   number;
  status:      QueryStatus;
  promise:     Promise<void> | null;  // deduplication
  subscribers: number;
  gcTimer:     ReturnType<typeof setTimeout> | null;
  invalidated: boolean;
}

const _cache = new Map<string, CacheEntry<unknown>>();

// Registry so invalidation can find live QueryResult handles
const _queryRegistry = new Map<string, Set<{ _onInvalidate: () => void }>>();

function _registerQuery(key: string, handle: { _onInvalidate: () => void }): void {
  if (!_queryRegistry.has(key)) {
    _queryRegistry.set(key, new Set());
  }
  _queryRegistry.get(key)!.add(handle);
}

function _unregisterQuery(key: string, handle: { _onInvalidate: () => void }): void {
  const set = _queryRegistry.get(key);
  if (set) {
    set.delete(handle);
    if (set.size === 0) _queryRegistry.delete(key);
  }
}

let _keyCounter = 0;
function _autoKey(): string {
  return `__query_${++_keyCounter}`;
}

// ── invalidateQuery / invalidateAllQueries ────────────────────────────

export function invalidateQuery(key: string | RegExp): void {
  if (typeof key === 'string') {
    const entry = _cache.get(key);
    if (entry) {
      entry.invalidated = true;
      entry.fetchedAt = 0;
    }
    const handles = _queryRegistry.get(key);
    if (handles) {
      for (const h of [...handles]) h._onInvalidate();
    }
  } else {
    for (const [k, entry] of _cache) {
      if (key.test(k)) {
        entry.invalidated = true;
        entry.fetchedAt = 0;
        const handles = _queryRegistry.get(k);
        if (handles) {
          for (const h of [...handles]) h._onInvalidate();
        }
      }
    }
  }
}

export function invalidateAllQueries(): void {
  for (const [k, entry] of _cache) {
    entry.invalidated = true;
    entry.fetchedAt = 0;
    const handles = _queryRegistry.get(k);
    if (handles) {
      for (const h of [...handles]) h._onInvalidate();
    }
  }
}

// ── createQuery ───────────────────────────────────────────────────────

export function createQuery<T>(
  fetcher: () => Promise<T>,
  opts?: QueryOptions<T>,
): QueryResult<T> {
  const staleTime = opts?.staleTime ?? 30_000;
  const gcTime    = opts?.gcTime    ?? 300_000;
  const maxRetry  = opts?.retry     ?? 2;

  // Resolve key
  let resolvedKey: string;
  if (opts?.key === undefined) {
    resolvedKey = _autoKey();
  } else if (typeof opts.key === 'function') {
    // Will be updated reactively
    resolvedKey = untrack(opts.key);
  } else {
    resolvedKey = opts.key;
  }

  // Ensure cache entry exists
  if (!_cache.has(resolvedKey)) {
    _cache.set(resolvedKey, {
      data:        opts?.initialData !== undefined ? (opts.initialData as unknown) : undefined,
      error:       null,
      fetchedAt:   opts?.initialData !== undefined ? Date.now() : 0,
      status:      opts?.initialData !== undefined ? 'success' : 'idle',
      promise:     null,
      subscribers: 0,
      gcTimer:     null,
      invalidated: false,
    });
  }

  const cacheEntry = (): CacheEntry<unknown> => _cache.get(resolvedKey)!;

  // Local reactive signals that mirror the cache
  const _data    = signal<T | undefined>(cacheEntry().data as T | undefined);
  const _error   = signal<Error | null>(cacheEntry().error);
  const _status  = signal<QueryStatus>(cacheEntry().status);
  const _fetchedAt = signal<number>(cacheEntry().fetchedAt);
  // _fetchedAtValue tracks the last fetch timestamp for stale computation
  // _staleOverride is used to force stale=true immediately (e.g., on invalidate)
  const _staleOverride = signal<boolean>(cacheEntry().fetchedAt === 0);

  const loading = computed<boolean>(() => {
    const s = _status();
    return s === 'loading' || s === 'refreshing';
  });

  // stale: recomputes based on current time every time it's accessed
  // Uses _fetchedAt and _staleOverride as reactive deps, but also reads Date.now() directly
  // so peek() always returns fresh value based on actual current time
  const _staleComputed = computed<boolean>(() => {
    const fetchedAt = _fetchedAt();
    _staleOverride(); // track override signal
    if (fetchedAt === 0) return true;
    if (_staleOverride.peek()) return true;
    return Date.now() - fetchedAt > staleTime;
  });

  // Override peek() to always recompute fresh (Date.now() not cached)
  const stale: ComputedSignal<boolean> = Object.assign(
    () => _staleComputed(),
    {
      isComputed: true as const,
      peek: (): boolean => {
        const fetchedAt = _fetchedAt.peek();
        if (fetchedAt === 0) return true;
        if (_staleOverride.peek()) return true;
        return Date.now() - fetchedAt > staleTime;
      },
      set: (_v: boolean): void => { throw new Error('[DRISHTI] stale is read-only'); },
      subscribe: _staleComputed.subscribe.bind(_staleComputed),
    },
  ) as ComputedSignal<boolean>;

  // _scheduleStaleTimer: no-op placeholder kept for future use
  const _scheduleStaleTimer = (_fetchedAt2: number): void => {
    void _fetchedAt2; // override manages stale state
    _staleOverride.set(false);
  };

  const disposers: Array<() => void> = [];
  let _fetchId = 0;
  let _destroyed = false;

  const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

  const _isEnabled = (): boolean => {
    if (opts?.enabled === undefined) return true;
    if (typeof opts.enabled === 'boolean') return opts.enabled;
    return opts.enabled();
  };

  const doFetch = async (): Promise<void> => {
    if (_destroyed) return;
    if (!_isEnabled()) return;

    const entry = cacheEntry();

    // Deduplication: if a fetch is in-flight, share it
    if (entry.promise !== null) {
      return entry.promise;
    }

    const id = ++_fetchId;
    const currentStatus = _status.peek();
    const newStatus: QueryStatus = currentStatus === 'success' ? 'refreshing' : 'loading';

    batch(() => {
      _status.set(newStatus);
      _error.set(null);
    });
    entry.status = newStatus;
    entry.error = null;

    let resolve!: () => void;
    const promise = new Promise<void>(r => { resolve = r; });
    entry.promise = promise;

    try {
      let result!: T;
      for (let attempt = 0; ; attempt++) {
        try {
          result = await untrack(fetcher);
          break;
        } catch (raw) {
          if (id !== _fetchId || _destroyed) {
            entry.promise = null;
            resolve();
            return;
          }
          if (attempt >= maxRetry) {
            const e = raw instanceof Error ? raw : new Error(String(raw));
            batch(() => {
              _error.set(e);
              _status.set('error');
            });
            entry.error = e;
            entry.status = 'error';
            entry.promise = null;
            resolve();
            opts?.onError?.(e);
            return;
          }
          const ms = 1000 * 2 ** attempt;
          await wait(ms);
        }
      }

      if (id !== _fetchId || _destroyed) {
        entry.promise = null;
        resolve();
        return;
      }

      const transformed = opts?.select ? (opts.select(result as unknown) as T) : result;
      const now = Date.now();

      batch(() => {
        _data.set(transformed);
        _status.set('success');
        _error.set(null);
        _fetchedAt.set(now);
      });
      _scheduleStaleTimer(now);

      entry.data = transformed as unknown;
      entry.status = 'success';
      entry.error = null;
      entry.fetchedAt = now;
      entry.invalidated = false;
      entry.promise = null;
      resolve();

      opts?.onSuccess?.(transformed);
    } catch {
      entry.promise = null;
      resolve();
    }
  };

  // Handle reactive key function
  if (typeof opts?.key === 'function') {
    const keyFn = opts.key;
    disposers.push(effect(() => {
      const newKey = keyFn();
      if (newKey !== resolvedKey) {
        // Unregister from old key
        _unregisterQuery(resolvedKey, handle);
        resolvedKey = newKey;

        // Ensure cache entry exists for new key
        if (!_cache.has(resolvedKey)) {
          _cache.set(resolvedKey, {
            data:        undefined,
            error:       null,
            fetchedAt:   0,
            status:      'idle',
            promise:     null,
            subscribers: 0,
            gcTimer:     null,
            invalidated: false,
          });
        }

        // Update local signals from new cache entry
        const newEntry = cacheEntry();
        batch(() => {
          _data.set(newEntry.data as T | undefined);
          _error.set(newEntry.error);
          _status.set(newEntry.status);
          _fetchedAt.set(newEntry.fetchedAt);
        });

        // Register with new key
        _registerQuery(resolvedKey, handle);

        // Fetch if needed
        void doFetch();
      }
    }));
  }

  // Initial fetch trigger via effect to track signal deps in fetcher
  // We use a flag to detect if signals inside fetcher change
  let effectRan = false;
  disposers.push(effect(() => {
    // Track signals used in fetcher by calling it inside the effect
    // but we don't actually run the fetch here — we just track deps
    // The trick: run fetcher inside untrack to get its shape,
    // but we need to track its signal reads...
    // Actually we need to track signals read during fetcher execution.
    // We do this by running fetcher and immediately cancelling, but that's expensive.
    // Instead: use a dummy run to track dependencies.
    // The approach: we wrap the fetcher call so signals are tracked by the effect.
    // We call fetcher() here (which tracks any signals it reads), but we
    // use its promise result only if it's the "real" fetch.

    // For reactive deps: we need to re-run doFetch when signals in fetcher change.
    // The standard pattern: call fetcher() inside the effect to track deps,
    // but separately run the real async fetch.

    // Check enabled state reactively
    const enabled = _isEnabled();

    if (!effectRan) {
      effectRan = true;
      if (enabled) {
        const entry = cacheEntry();
        const age = Date.now() - entry.fetchedAt;
        if (entry.fetchedAt === 0 || age >= staleTime || entry.invalidated) {
          void doFetch();
        }
      }
    } else {
      // Re-run triggered by a signal change
      if (enabled) {
        void doFetch();
      }
    }
  }));

  // Focus refetch
  if ((opts?.refetchOnFocus ?? true) && typeof window !== 'undefined') {
    const onFocus = () => {
      if (_destroyed) return;
      const age = Date.now() - cacheEntry().fetchedAt;
      if (age >= staleTime) void doFetch();
    };
    window.addEventListener('focus', onFocus);
    disposers.push(() => window.removeEventListener('focus', onFocus));
  }

  // Poll interval
  if (opts?.refetchInterval !== undefined && opts.refetchInterval > 0) {
    const timer = setInterval(() => {
      if (!_destroyed) void doFetch();
    }, opts.refetchInterval);
    disposers.push(() => clearInterval(timer));
  }

  const handle = {
    _onInvalidate: () => {
      const entry = cacheEntry();
      entry.invalidated = true;
      entry.fetchedAt = 0;
      _staleOverride.set(true);
      void doFetch();
    },
  };

  _registerQuery(resolvedKey, handle);
  cacheEntry().subscribers++;

  const result: QueryResult<T> = {
    data:    _data,
    error:   _error,
    status:  _status,
    loading,
    stale,

    refetch: () => doFetch(),

    optimisticUpdate(updater: (prev: T | undefined) => T): () => void {
      const prev = _data.peek();
      const next = updater(prev);
      _data.set(next);
      const entry = cacheEntry();
      entry.data = next as unknown;
      return () => {
        _data.set(prev);
        entry.data = prev as unknown;
      };
    },

    invalidate(): void {
      const entry = cacheEntry();
      entry.invalidated = true;
      entry.fetchedAt = 0;
      _fetchedAt.set(0);
      _staleOverride.set(true);
      void doFetch();
    },

    destroy(): void {
      if (_destroyed) return;
      _destroyed = true;
      for (const d of disposers) d();
      _unregisterQuery(resolvedKey, handle);

      const entry = _cache.get(resolvedKey);
      if (entry) {
        entry.subscribers = Math.max(0, entry.subscribers - 1);
        if (entry.subscribers === 0 && gcTime > 0) {
          if (entry.gcTimer !== null) clearTimeout(entry.gcTimer);
          entry.gcTimer = setTimeout(() => {
            _cache.delete(resolvedKey);
          }, gcTime);
        }
      }
    },
  };

  return result;
}

// ── createQueryMutation ───────────────────────────────────────────────

export function createQueryMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  opts?: MutationOptions<TInput, TOutput>,
): MutationResult<TInput, TOutput> {
  const _data    = signal<TOutput | undefined>(undefined);
  const _loading = signal<boolean>(false);
  const _error   = signal<Error | null>(null);
  const _status  = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

  const mutate = async (input: TInput): Promise<TOutput> => {
    let context: unknown;
    batch(() => {
      _loading.set(true);
      _error.set(null);
      _status.set('loading');
    });

    try {
      context = opts?.onMutate ? opts.onMutate(input) : undefined;
      const result = await mutationFn(input);

      batch(() => {
        _data.set(result);
        _loading.set(false);
        _status.set('success');
      });

      if (opts?.onSuccess) {
        await opts.onSuccess(result, input, context);
      }

      if (opts?.invalidates) {
        for (const key of opts.invalidates) {
          invalidateQuery(key);
        }
      }

      opts?.onSettled?.(result, null, input);
      return result;
    } catch (raw) {
      const e = raw instanceof Error ? raw : new Error(String(raw));
      batch(() => {
        _error.set(e);
        _loading.set(false);
        _status.set('error');
      });
      opts?.onError?.(e, input, context);
      opts?.onSettled?.(undefined, e, input);
      throw e;
    }
  };

  return {
    data:    _data,
    error:   _error,
    loading: _loading,
    status:  _status,
    mutate,
    reset(): void {
      batch(() => {
        _data.set(undefined);
        _loading.set(false);
        _error.set(null);
        _status.set('idle');
      });
    },
  };
}
