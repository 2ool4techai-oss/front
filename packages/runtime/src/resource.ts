import { signal, computed, effect, batch } from './signal.js';
import type { ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type ResourceStatus  = 'idle' | 'loading' | 'success' | 'error';
export type MutationStatus  = 'idle' | 'loading' | 'success' | 'error';

export interface ResourceOptions<T> {
  initialValue?:   T;
  staleTime?:      number;
  retry?:          number;
  retryDelay?:     number | ((attempt: number) => number);
  enabled?:        () => boolean;
  refetchOnFocus?: boolean;
  refetchInterval?: number;
  onSuccess?:      (data: T) => void;
  onError?:        (err: Error) => void;
}

export interface Resource<T> {
  readonly data:    ComputedSignal<T | undefined>;
  readonly loading: ComputedSignal<boolean>;
  readonly error:   ComputedSignal<Error | null>;
  readonly status:  ComputedSignal<ResourceStatus>;
  refetch():                                          Promise<void>;
  mutate(value: T | ((prev: T | undefined) => T)):    void;
  destroy():                                          void;
}

export interface MutationOptions<TInput, TOutput> {
  onMutate?:   (input: TInput) => Promise<unknown> | unknown;
  onSuccess?:  (data: TOutput, input: TInput, context: unknown) => void;
  onError?:    (err: Error,    input: TInput, context: unknown) => void;
  onSettled?:  (data: TOutput | undefined, err: Error | null, input: TInput) => void;
}

export interface Mutation<TInput, TOutput> {
  readonly loading: ComputedSignal<boolean>;
  readonly error:   ComputedSignal<Error | null>;
  readonly data:    ComputedSignal<TOutput | undefined>;
  readonly status:  ComputedSignal<MutationStatus>;
  mutate(input: TInput): Promise<TOutput>;
  reset(): void;
}

export interface CacheGetOptions {
  staleTime?: number;
  gcTime?:    number;
  retry?:     number;
}

export interface CacheOptions {
  defaultStaleTime?: number;
  defaultGcTime?:    number;
}

export interface Cache {
  get<T>(key: string, fetcher: () => Promise<T>, opts?: CacheGetOptions): Resource<T>;
  invalidate(key: string | RegExp): void;
  invalidateAll(): void;
  prefetch<T>(key: string, fetcher: () => Promise<T>): Promise<void>;
  readonly size: number;
}

// ── createResource ─────────────────────────────────────────────────────

export function createResource<T>(
  fetcher: () => Promise<T>,
  opts: ResourceOptions<T> = {},
): Resource<T> {
  const staleTime  = opts.staleTime  ?? 0;
  const maxRetry   = opts.retry      ?? 1;
  const retryDelay = opts.retryDelay ?? ((n: number) => Math.min(1000 * 2 ** (n - 1), 30_000));

  const _data      = signal<T | undefined>(opts.initialValue as T | undefined);
  const _loading   = signal(false);
  const _error     = signal<Error | null>(null);
  const _fetchedAt = signal(0);

  const disposers: Array<() => void> = [];
  let _fetchId = 0;

  const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

  const doFetch = async (): Promise<void> => {
    const id = ++_fetchId;
    batch(() => { _loading.set(true); _error.set(null); });

    for (let attempt = 0; ; attempt++) {
      try {
        const result = await fetcher();
        if (id !== _fetchId) return;
        batch(() => { _data.set(result); _loading.set(false); _fetchedAt.set(Date.now()); });
        opts.onSuccess?.(result);
        return;
      } catch (raw) {
        if (id !== _fetchId) return;
        if (attempt >= maxRetry) {
          const e = raw instanceof Error ? raw : new Error(String(raw));
          batch(() => { _error.set(e); _loading.set(false); });
          opts.onError?.(e);
          return;
        }
        const ms = typeof retryDelay === 'function' ? retryDelay(attempt + 1) : retryDelay;
        await wait(ms);
      }
    }
  };

  // conditional / reactive fetch
  if (opts.enabled !== undefined) {
    const enabledFn = opts.enabled;
    disposers.push(effect(() => {
      if (enabledFn()) {
        const age = Date.now() - _fetchedAt.peek();
        if (age >= staleTime) void doFetch();
      }
    }));
  } else {
    void doFetch();
  }

  if (opts.refetchOnFocus && typeof window !== 'undefined') {
    const onFocus = () => {
      if (Date.now() - _fetchedAt.peek() >= staleTime) void doFetch();
    };
    window.addEventListener('focus', onFocus);
    disposers.push(() => window.removeEventListener('focus', onFocus));
  }

  if (opts.refetchInterval !== undefined) {
    const interval = opts.refetchInterval;
    const timer = setInterval(() => void doFetch(), interval);
    disposers.push(() => clearInterval(timer));
  }

  return {
    data:    computed(() => _data()),
    loading: computed(() => _loading()),
    error:   computed(() => _error()),
    status:  computed((): ResourceStatus => {
      if (_loading()) return 'loading';
      if (_error() !== null) return 'error';
      if (_data() !== undefined) return 'success';
      return 'idle';
    }),
    refetch: () => doFetch(),
    mutate:  (valueOrFn) => {
      if (typeof valueOrFn === 'function') {
        _data.set((valueOrFn as (prev: T | undefined) => T)(_data.peek()));
      } else {
        _data.set(valueOrFn);
      }
    },
    destroy: () => { for (const d of disposers) d(); },
  };
}

// ── createMutation ─────────────────────────────────────────────────────

export function createMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  opts: MutationOptions<TInput, TOutput> = {},
): Mutation<TInput, TOutput> {
  const _data    = signal<TOutput | undefined>(undefined);
  const _loading = signal(false);
  const _error   = signal<Error | null>(null);
  const _status  = signal<MutationStatus>('idle');

  const mutate = async (input: TInput): Promise<TOutput> => {
    let context: unknown;
    batch(() => { _loading.set(true); _error.set(null); _status.set('loading'); });
    try {
      context = opts.onMutate ? await opts.onMutate(input) : undefined;
      const result = await mutationFn(input);
      batch(() => { _data.set(result); _loading.set(false); _status.set('success'); });
      opts.onSuccess?.(result, input, context);
      opts.onSettled?.(result, null, input);
      return result;
    } catch (raw) {
      const e = raw instanceof Error ? raw : new Error(String(raw));
      batch(() => { _error.set(e); _loading.set(false); _status.set('error'); });
      opts.onError?.(e, input, context);
      opts.onSettled?.(undefined, e, input);
      throw e;
    }
  };

  return {
    data:    computed(() => _data()),
    loading: computed(() => _loading()),
    error:   computed(() => _error()),
    status:  computed(() => _status()),
    mutate,
    reset:   () => {
      batch(() => {
        _data.set(undefined); _loading.set(false);
        _error.set(null);     _status.set('idle');
      });
    },
  };
}

// ── createCache ────────────────────────────────────────────────────────

export function createCache(opts: CacheOptions = {}): Cache {
  const defaultStaleTime = opts.defaultStaleTime ?? 0;
  const defaultGcTime    = opts.defaultGcTime    ?? 5 * 60_000;

  interface Entry {
    resource: Resource<unknown>;
    gcTimer:  ReturnType<typeof setTimeout> | null;
  }

  const entries = new Map<string, Entry>();

  const get = <T>(key: string, fetcher: () => Promise<T>, entryOpts: CacheGetOptions = {}): Resource<T> => {
    const existing = entries.get(key);
    if (existing) return existing.resource as Resource<T>;

    const staleTime = entryOpts.staleTime ?? defaultStaleTime;
    const gcTime    = entryOpts.gcTime    ?? defaultGcTime;

    const rOpts: ResourceOptions<T> = { staleTime };
    if (entryOpts.retry !== undefined) rOpts.retry = entryOpts.retry;
    const resource = createResource<T>(fetcher, rOpts);

    const gcTimer = gcTime > 0
      ? setTimeout(() => { resource.destroy(); entries.delete(key); }, gcTime)
      : null;

    entries.set(key, { resource: resource as Resource<unknown>, gcTimer });
    return resource;
  };

  return {
    get,
    invalidate(key: string | RegExp): void {
      if (typeof key === 'string') {
        entries.get(key)?.resource.refetch();
      } else {
        for (const [k, e] of entries) {
          if (key.test(k)) void e.resource.refetch();
        }
      }
    },
    invalidateAll(): void {
      for (const e of entries.values()) void e.resource.refetch();
    },
    async prefetch<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
      get(key, fetcher);
    },
    get size() { return entries.size; },
  };
}
