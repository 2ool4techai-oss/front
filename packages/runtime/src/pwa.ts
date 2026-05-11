import { signal } from './signal.js';
import type { Signal } from './types.js';

export interface PWAOptions {
  onOnline?:  () => void;
  onOffline?: () => void;
  onUpdate?:  (reg: unknown) => void;
}

export interface PWAHandle {
  readonly online:      Signal<boolean>;
  readonly swStatus:    Signal<'unsupported' | 'installing' | 'active' | 'waiting' | 'error'>;
  readonly updateReady: Signal<boolean>;
  registerSW(swUrl: string): Promise<void>;
  skipWaiting(): void;
  destroy(): void;
}

export interface OfflineQueueOptions<T> {
  onFlush:     (items: T[]) => Promise<void>;
  maxItems?:   number;
  storageKey?: string;
}

export interface OfflineQueueHandle<T> {
  readonly queue:    Signal<T[]>;
  readonly flushing: Signal<boolean>;
  enqueue(item: T): void;
  flush(): Promise<void>;
  clear(): void;
  destroy(): void;
}

export function createPWA(opts?: PWAOptions): PWAHandle {
  const online      = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const swStatus    = signal<'unsupported' | 'installing' | 'active' | 'waiting' | 'error'>(
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? 'installing'
      : 'unsupported'
  );
  const updateReady = signal<boolean>(false);

  let waitingWorker: ServiceWorker | null = null;

  const onOnline  = () => { online.set(true);  opts?.onOnline?.();  };
  const onOffline = () => { online.set(false); opts?.onOffline?.(); };

  if (typeof window !== 'undefined') {
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
  }

  async function registerSW(swUrl: string): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      swStatus.set('unsupported');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register(swUrl);
      if (reg.installing) {
        swStatus.set('installing');
        reg.installing.addEventListener('statechange', () => {
          if (reg.active) swStatus.set('active');
        });
      } else if (reg.waiting) {
        swStatus.set('waiting');
        waitingWorker = reg.waiting;
        updateReady.set(true);
        opts?.onUpdate?.(reg);
      } else if (reg.active) {
        swStatus.set('active');
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        swStatus.set('installing');
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker = newWorker;
            swStatus.set('waiting');
            updateReady.set(true);
            opts?.onUpdate?.(reg);
          } else if (newWorker.state === 'activated') {
            swStatus.set('active');
          }
        });
      });
    } catch {
      swStatus.set('error');
    }
  }

  function skipWaiting(): void {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  }

  function destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    }
  }

  return { online, swStatus, updateReady, registerSW, skipWaiting, destroy };
}

export function createOfflineQueue<T>(opts: OfflineQueueOptions<T>): OfflineQueueHandle<T> {
  const maxItems   = opts.maxItems   ?? 500;
  const storageKey = opts.storageKey ?? '__offlineQueue';

  function load(): T[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  }

  function save(items: T[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // best-effort
    }
  }

  const queue    = signal<T[]>(load());
  const flushing = signal<boolean>(false);

  async function flush(): Promise<void> {
    const items = queue.peek();
    if (items.length === 0) return;
    flushing.set(true);
    try {
      await opts.onFlush([...items]);
      queue.set([]);
      save([]);
    } finally {
      flushing.set(false);
    }
  }

  const onOnlineFlush = () => { void flush(); };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnlineFlush);
  }

  return {
    get queue(): Signal<T[]> { return queue; },
    get flushing(): Signal<boolean> { return flushing; },

    enqueue(item: T): void {
      const current = [...queue.peek()];
      if (current.length >= maxItems) {
        current.shift();
      }
      current.push(item);
      queue.set(current);
      save(current);
    },

    flush,

    clear(): void {
      queue.set([]);
      save([]);
    },

    destroy(): void {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnlineFlush);
      }
    },
  };
}
