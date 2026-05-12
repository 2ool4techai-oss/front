import { signal, effect } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface LazySignalOptions {
  loader: () => Promise<{ default: () => HTMLElement }>;
  trigger?: 'immediate' | 'visible' | 'interaction' | (() => boolean);
  placeholder?: () => HTMLElement;
}

export type LazyStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface LazySignalType<T> {
  (): T | undefined;
  status: () => LazyStatus;
  load: () => Promise<void>;
  peek: () => T | undefined;
  set: (value: T) => void;
  subscribe: (fn: (value: T | undefined) => void) => () => void;
}

// ── lazySignal ─────────────────────────────────────────────────────────
//
// Lazy-loads a module when the signal is first read (or .load() is called).
// The default trigger is 'interaction' — callers use .load() explicitly in
// test environments and the trigger fires automatically in the browser.

export function lazySignal<T>(
  loader: () => Promise<{ default: any }>,
  opts?: LazySignalOptions,
): LazySignalType<T> {
  const _value = signal<T | undefined>(undefined);
  const _status = signal<LazyStatus>('idle');
  let _loadPromise: Promise<void> | null = null;

  const load = async (): Promise<void> => {
    // If already loading or loaded, return the existing promise
    if (_status.peek() === 'loading') return _loadPromise ?? Promise.resolve();
    if (_status.peek() === 'loaded') return Promise.resolve();

    _status.set('loading');
    _loadPromise = (async () => {
      try {
        const mod = await loader();
        // If default is a factory function (e.g. () => HTMLElement), call it to get the value.
        // Otherwise use default directly (e.g. a string, number, object).
        const resolved: T =
          typeof mod.default === 'function'
            ? (mod.default() as T)
            : (mod.default as T);
        _value.set(resolved);
        _status.set('loaded');
      } catch (err) {
        _status.set('error');
        throw err;
      }
    })();
    return _loadPromise;
  };

  // Handle trigger — default is 'interaction' (not immediate) so construction is side-effect free
  const trigger = opts?.trigger ?? 'interaction';

  if (trigger === 'immediate') {
    // Start loading right away (async, non-blocking)
    load().catch(() => {});
  } else if (typeof trigger === 'function') {
    // Reactive condition — re-evaluate whenever deps change
    effect(() => {
      if (trigger()) {
        load().catch(() => {});
      }
    });
  } else if (trigger === 'interaction') {
    // Load on first user interaction in browser environments
    if (typeof window !== 'undefined') {
      const events = ['click', 'mousemove', 'touchstart', 'keydown', 'scroll'];
      const onInteract = () => {
        events.forEach((e) => window.removeEventListener(e, onInteract));
        load().catch(() => {});
      };
      events.forEach((e) => window.addEventListener(e, onInteract, { once: true, passive: true } as AddEventListenerOptions));
    }
    // In node/test environment: call .load() explicitly
  }
  // 'visible' trigger — requires an element ref; callers use .load() directly

  const sig = Object.assign(
    function (): T | undefined {
      return _value();
    },
    {
      status: () => _status(),
      load,
      peek: () => _value.peek(),
      set: (value: T) => _value.set(value),
      subscribe: (fn: (value: T | undefined) => void) => _value.subscribe(fn),
    },
  ) as LazySignalType<T>;

  return sig;
}

// ── splitOn ────────────────────────────────────────────────────────────
//
// Code-splits based on a signal's boolean/truthy value.
// The loader is called with the current signal value only when it is truthy.
// When the signal value changes (and is truthy), the loader is called again.

export function splitOn<T>(
  sig: Signal<T> | (() => T),
  loader: (value: T) => Promise<any>,
): { value: () => any; status: () => LazyStatus; load: () => Promise<void> } {
  const _value = signal<any>(undefined);
  const _status = signal<LazyStatus>('idle');
  let _lastLoadedValue: T | undefined;
  let _loadPromise: Promise<void> | null = null;

  const doLoad = async (val: T): Promise<void> => {
    // Skip if we already loaded this value
    if (Object.is(_lastLoadedValue, val) && (_status.peek() === 'loaded' || _status.peek() === 'loading')) {
      return _loadPromise ?? Promise.resolve();
    }
    _lastLoadedValue = val;
    _status.set('loading');
    _loadPromise = (async () => {
      try {
        const mod = await loader(val);
        _value.set(mod?.default ?? mod);
        _status.set('loaded');
      } catch {
        _status.set('error');
      }
    })();
    return _loadPromise;
  };

  effect(() => {
    const current = (sig as Signal<T>)();
    // Only fire when value is truthy — this is a conditional code-split
    if (current) {
      doLoad(current).catch(() => {});
    }
  });

  return {
    value: () => _value(),
    status: () => _status(),
    load: () => {
      const val = (sig as Signal<T>).peek ? (sig as Signal<T>).peek() : (sig as () => T)();
      return doLoad(val);
    },
  };
}

// ── prefetchWhen ───────────────────────────────────────────────────────
//
// Prefetch a chunk when a condition becomes true.
// The loader is called at most once regardless of how often the condition toggles.

export function prefetchWhen(condition: () => boolean, loader: () => Promise<any>): void {
  let prefetched = false;

  effect(() => {
    if (condition() && !prefetched) {
      prefetched = true;
      // Warm the bundle cache — ignore the result
      loader().catch(() => {});
    }
  });
}
