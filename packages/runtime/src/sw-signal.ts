import { signal } from './signal.js';
import type { Signal } from './types.js';

export interface SWSignalOptions<T> {
  cacheName?: string;
  maxAge?:    number;
  strategy?:  'cache-first' | 'network-first' | 'stale-while-revalidate';
  parse?:     (raw: string) => T;
}

export interface SWSignalHandle<T> {
  readonly data:      Signal<T | undefined>;
  readonly fromCache: Signal<boolean>;
  readonly stale:     Signal<boolean>;
  fetch(url: string): Promise<void>;
  invalidate():       void;
  destroy():          void;
}

export function createSWSignal<T>(opts?: SWSignalOptions<T>): SWSignalHandle<T> {
  const cacheName = opts?.cacheName ?? 'drishti-sw';
  const maxAge    = opts?.maxAge    ?? 3600;
  const strategy  = opts?.strategy  ?? 'cache-first';
  const parse     = opts?.parse     ?? ((raw: string) => JSON.parse(raw) as T);

  const data      = signal<T | undefined>(undefined);
  const fromCache = signal<boolean>(false);
  const stale     = signal<boolean>(false);

  let destroyed = false;

  async function readResponse(response: Response): Promise<T> {
    const text = await response.text();
    return parse(text);
  }

  function isStale(response: Response): boolean {
    const date = response.headers.get('date');
    if (!date) return false;
    const age = (Date.now() - new Date(date).getTime()) / 1000;
    return age > maxAge;
  }

  async function fetchAndCache(url: string, cache: Cache): Promise<Response | null> {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) {
        await cache.put(url, response.clone());
        return response;
      }
      return null;
    } catch {
      return null;
    }
  }

  return {
    data,
    fromCache,
    stale,

    async fetch(url: string): Promise<void> {
      if (destroyed) return;
      if (typeof caches === 'undefined') {
        // No Cache API — fall back to plain fetch
        try {
          const response = await globalThis.fetch(url);
          if (response.ok) {
            const parsed = await readResponse(response);
            data.set(parsed);
            fromCache.set(false);
            stale.set(false);
          }
        } catch {
          // ignore
        }
        return;
      }

      const cache = await caches.open(cacheName);

      if (strategy === 'cache-first') {
        const cached = await cache.match(url);
        if (cached) {
          const parsed = await readResponse(cached);
          data.set(parsed);
          fromCache.set(true);
          stale.set(isStale(cached));
          return;
        }
        const networkResponse = await fetchAndCache(url, cache);
        if (networkResponse) {
          const parsed = await readResponse(networkResponse);
          data.set(parsed);
          fromCache.set(false);
          stale.set(false);
        }

      } else if (strategy === 'network-first') {
        const networkResponse = await fetchAndCache(url, cache);
        if (networkResponse) {
          const parsed = await readResponse(networkResponse);
          data.set(parsed);
          fromCache.set(false);
          stale.set(false);
          return;
        }
        const cached = await cache.match(url);
        if (cached) {
          const parsed = await readResponse(cached);
          data.set(parsed);
          fromCache.set(true);
          stale.set(isStale(cached));
        }

      } else if (strategy === 'stale-while-revalidate') {
        const cached = await cache.match(url);
        if (cached) {
          const parsed = await readResponse(cached);
          data.set(parsed);
          fromCache.set(true);
          stale.set(true);
        }
        // Revalidate in background
        const networkResponse = await fetchAndCache(url, cache);
        if (networkResponse && !destroyed) {
          const parsed = await readResponse(networkResponse);
          data.set(parsed);
          fromCache.set(false);
          stale.set(false);
        }
      }
    },

    invalidate(): void {
      if (typeof caches === 'undefined') return;
      void (async () => {
        try {
          const c = await caches.open(cacheName);
          const keys = await c.keys();
          await Promise.all(keys.map(k => c.delete(k)));
        } catch { /* ignore */ }
      })();
    },

    destroy(): void {
      destroyed = true;
    },
  };
}
