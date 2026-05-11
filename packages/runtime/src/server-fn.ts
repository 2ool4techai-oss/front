import { signal, batch } from './signal.js';
import type { Signal } from './types.js';

export interface ServerFnOptions {
  cache?: number;
  revalidate?: number;
}

export interface ServerFnHandle<TArgs extends unknown[], TReturn> {
  (...args: TArgs): Promise<TReturn>;
  invalidate(): void;
  readonly loading: Signal<boolean>;
  readonly error: Signal<unknown>;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function createServerFn<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  opts?: ServerFnOptions,
): ServerFnHandle<TArgs, TReturn> {
  const loadingSignal = signal<boolean>(false);
  const errorSignal = signal<unknown>(undefined);
  const cache = new Map<string, CacheEntry<TReturn>>();

  async function handler(...args: TArgs): Promise<TReturn> {
    const key = JSON.stringify(args);

    // Check cache
    if (opts?.cache !== undefined) {
      const entry = cache.get(key);
      if (entry !== undefined) {
        const age = (Date.now() - entry.timestamp) / 1000;
        if (age < opts.cache) {
          return entry.data;
        }
      }
    }

    batch(() => {
      loadingSignal.set(true);
      errorSignal.set(undefined);
    });

    try {
      const result = await fn(...args);

      if (opts?.cache !== undefined) {
        cache.set(key, { data: result, timestamp: Date.now() });
      }

      batch(() => {
        loadingSignal.set(false);
        errorSignal.set(undefined);
      });

      return result;
    } catch (err) {
      batch(() => {
        loadingSignal.set(false);
        errorSignal.set(err);
      });
      throw err;
    }
  }

  function invalidate(): void {
    cache.clear();
  }

  return Object.assign(handler, {
    invalidate,
    get loading(): Signal<boolean> { return loadingSignal; },
    get error(): Signal<unknown> { return errorSignal; },
  }) as ServerFnHandle<TArgs, TReturn>;
}
