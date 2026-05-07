import { signal, effect, batch } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type StorageType = 'local' | 'session';

export interface PersistOptions<T> {
  storage?:     StorageType;
  serialize?:   (value: T) => string;
  deserialize?: (raw: string) => T;
  /** Called when deserialization fails — return a fallback value */
  onError?:     (err: unknown, key: string) => T | undefined;
}

export interface PersistedSignal<T> extends Signal<T> {
  /** Remove this key from storage and reset to initial value */
  clear(): void;
}

// ── persistSignal ──────────────────────────────────────────────────────
// Wraps an existing signal, syncing its value to Web Storage.
// The stored value is loaded immediately on creation.
//
// Usage:
//   const theme = persistSignal('theme', signal<'light' | 'dark'>('light'));
//   theme.set('dark'); // automatically persisted

export function persistSignal<T>(
  key:  string,
  sig:  Signal<T>,
  opts: PersistOptions<T> = {},
): PersistedSignal<T> {
  if (typeof window === 'undefined') {
    return Object.assign(sig, { clear: () => {} }) as PersistedSignal<T>;
  }

  const store       = opts.storage === 'session' ? sessionStorage : localStorage;
  const serialize   = opts.serialize   ?? JSON.stringify;
  const deserialize = opts.deserialize ?? ((s) => JSON.parse(s) as T);

  // Load initial value from storage
  try {
    const raw = store.getItem(key);
    if (raw !== null) sig.set(deserialize(raw));
  } catch (err) {
    const fallback = opts.onError?.(err, key);
    if (fallback !== undefined) sig.set(fallback);
  }

  // Sync signal changes to storage
  effect(() => {
    try {
      store.setItem(key, serialize(sig()));
    } catch {
      // Quota exceeded or private browsing — fail silently
    }
  });

  // Sync storage events (cross-tab sync for localStorage)
  if (opts.storage !== 'session') {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.storageArea !== store) return;
      try {
        if (e.newValue === null) {
          // key was deleted in another tab
        } else {
          const next = deserialize(e.newValue);
          sig.set(next);
        }
      } catch (err) {
        const fallback = opts.onError?.(err, key);
        if (fallback !== undefined) sig.set(fallback);
      }
    };
    window.addEventListener('storage', onStorage);
    // Note: no cleanup — persisted signals are typically app-lifetime
  }

  return Object.assign(sig, {
    clear: () => {
      store.removeItem(key);
    },
  }) as PersistedSignal<T>;
}

// ── createPersistedStore ───────────────────────────────────────────────
// Like createStore() but automatically persisted to Web Storage.
//
// Usage:
//   const prefs = createPersistedStore('prefs', { theme: 'dark', fontSize: 14 });
//   prefs.set({ theme: 'light' }); // persisted
//   prefs.reset();                 // clears storage, reverts to initial

export interface PersistedStore<T extends Record<string, unknown>> {
  get():                          T;
  set(patch: Partial<T>):         void;
  reset():                        void;
  clear():                        void;
  readonly signal:                Signal<T>;
}

export function createPersistedStore<T extends Record<string, unknown>>(
  key:     string,
  initial: T,
  opts:    PersistOptions<T> = {},
): PersistedStore<T> {
  const _initial = { ...initial };
  const _sig = persistSignal<T>(key, signal<T>({ ..._initial }), opts);

  return {
    get:    () => _sig(),
    set:    (patch: Partial<T>) => {
      batch(() => _sig.set({ ..._sig.peek(), ...patch }));
    },
    reset:  () => _sig.set({ ..._initial }),
    clear:  () => _sig.clear(),
    signal: _sig,
  };
}
