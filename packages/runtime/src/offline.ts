import { signal, effect } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface OfflineSignalOptions<T> {
  key: string;
  sync?: 'immediate' | 'when-online' | 'manual';
  conflict?: 'last-write' | 'merge' | ((local: T, remote: T) => T);
  remote?: {
    get: () => Promise<T>;
    set: (value: T) => Promise<void>;
  };
}

export interface OfflineSignalType<T> extends Signal<T> {
  /** Manually trigger a sync with remote */
  syncNow(): Promise<void>;
  /** Whether a remote sync is pending */
  readonly pendingSync: Signal<boolean>;
}

// ── Online status ──────────────────────────────────────────────────────

const _onlineSignal = signal<boolean>(
  typeof navigator !== 'undefined' ? navigator.onLine : true,
);

if (typeof window !== 'undefined') {
  window.addEventListener('online',  () => _onlineSignal.set(true));
  window.addEventListener('offline', () => _onlineSignal.set(false));
}

export function isOnline(): boolean {
  return _onlineSignal();
}

const _onceOnlineCallbacks: Array<() => void> = [];

export function onceOnline(fn: () => void): void {
  if (_onlineSignal.peek()) {
    fn();
    return;
  }
  _onceOnlineCallbacks.push(fn);
}

// Flush once-online callbacks when we come online
effect(() => {
  if (_onlineSignal()) {
    const toRun = _onceOnlineCallbacks.splice(0);
    for (const fn of toRun) {
      try { fn(); } catch { /* ignore callback errors */ }
    }
  }
});

// ── Conflict resolution ────────────────────────────────────────────────

function resolveConflict<T>(
  local: T,
  remote: T,
  strategy: OfflineSignalOptions<T>['conflict'],
): T {
  if (!strategy || strategy === 'last-write') {
    return local; // local wins (last write)
  }
  if (strategy === 'merge') {
    // For objects, shallow-merge remote into local; for primitives, use local
    if (
      local !== null &&
      typeof local === 'object' &&
      !Array.isArray(local) &&
      remote !== null &&
      typeof remote === 'object' &&
      !Array.isArray(remote)
    ) {
      return { ...(remote as object), ...(local as object) } as T;
    }
    return local;
  }
  // Custom merge function
  if (typeof strategy === 'function') {
    return strategy(local, remote);
  }
  return local;
}

// ── offlineSignal ──────────────────────────────────────────────────────

export function offlineSignal<T>(
  initial: T,
  opts: OfflineSignalOptions<T>,
): OfflineSignalType<T> {
  const { key, sync = 'when-online', remote } = opts;

  // Load from localStorage immediately
  // Storage format: { value: T, ts: number }
  let storedValue = initial;
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as unknown;
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'value' in (parsed as object)
        ) {
          storedValue = (parsed as { value: T }).value;
        } else {
          // Legacy: plain value stored directly
          storedValue = parsed as T;
        }
      }
    } catch { /* ignore parse errors, use initial */ }
  }

  const base = signal<T>(storedValue);
  const pendingSync = signal<boolean>(false);
  let _pendingSyncValue: T | null = null;

  // Persist to localStorage whenever value changes (format: { value, ts })
  effect(() => {
    const val = base();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify({ value: val, ts: Date.now() }));
      } catch { /* quota exceeded — ignore */ }
    }
  });

  async function pushToRemote(value: T): Promise<void> {
    if (!remote) return;
    try {
      await remote.set(value);
      pendingSync.set(false);
      _pendingSyncValue = null;
    } catch {
      // Failed — will retry when online again
      pendingSync.set(true);
      _pendingSyncValue = value;
    }
  }

  async function syncNow(): Promise<void> {
    if (!remote) return;
    pendingSync.set(true);

    try {
      const remoteVal = await remote.get();
      const localVal  = base.peek();
      const resolved  = resolveConflict(localVal, remoteVal, opts.conflict);
      base.set(resolved);
      // Push resolved value back
      await remote.set(resolved);
      pendingSync.set(false);
      _pendingSyncValue = null;
    } catch {
      pendingSync.set(false);
    }
  }

  // React to value changes for immediate/when-online sync
  effect(() => {
    const val = base();
    if (!remote) return;

    if (sync === 'immediate') {
      void pushToRemote(val);
    } else if (sync === 'when-online') {
      if (_onlineSignal()) {
        void pushToRemote(val);
      } else {
        pendingSync.set(true);
        _pendingSyncValue = val;
      }
    }
    // 'manual' — do nothing automatically
  });

  // When we come back online, flush pending sync
  effect(() => {
    if (_onlineSignal() && pendingSync.peek() && _pendingSyncValue !== null && remote) {
      const toSync = _pendingSyncValue;
      void pushToRemote(toSync);
    }
  });

  return Object.assign(base, {
    syncNow,
    pendingSync,
  }) as OfflineSignalType<T>;
}
