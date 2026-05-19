import { signal, effect, computed } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface LearningProfile {
  userId?: string;
  preferences: Record<string, unknown>;
  patterns: Array<{ action: string; frequency: number; lastSeen: number }>;
  adaptations: Record<string, unknown>;
  version: number;
  updatedAt: number;
}

export interface CrossSessionOptions {
  storage?: 'localStorage' | 'indexedDB' | 'custom';
  userId?: string;
  ttl?: number;           // days, default 30
  customStorage?: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
}

export interface LearningProfileStore {
  profile: () => LearningProfile;
  record: (action: string, value?: unknown) => void;
  adapt: <T>(key: string, defaultValue: T) => () => T;  // returns reactive adaptation
  reset: () => void;
  export: () => LearningProfile;
  import: (profile: LearningProfile) => void;
}

export interface AdaptiveSignalType<T> {
  (): T;
  set: (value: T) => void;
  peek: () => T;
  subscribe: (fn: (value: T) => void) => () => void;
  preferred: () => T;
  frequencies: () => Array<{ value: T; frequency: number }>;
}

// ── Helpers ────────────────────────────────────────────────────────────

const PROFILE_VERSION = 1;
const DEFAULT_TTL_DAYS = 30;

function profileKey(userId?: string): string {
  return userId ? `__drishti_profile_${userId}__` : '__drishti_profile__';
}

function makeEmptyProfile(userId?: string): LearningProfile {
  return {
    ...(userId !== undefined ? { userId } : {}),
    preferences: {},
    patterns: [],
    adaptations: {},
    version: PROFILE_VERSION,
    updatedAt: Date.now(),
  };
}

function isExpired(profile: LearningProfile, ttlDays: number): boolean {
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return Date.now() - profile.updatedAt > ttlMs;
}

// ── LocalStorage adapter ───────────────────────────────────────────────

function lsGet(key: string): LearningProfile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as LearningProfile;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: LearningProfile): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded — fail silently
  }
}

// ── IndexedDB adapter ─────────────────────────────────────────────────

const IDB_DB = '__drishti_cs__';
const IDB_STORE = 'profiles';
const IDB_VERSION = 1;

let _idbPromise: Promise<IDBDatabase> | null = null;

function openIDB(): Promise<IDBDatabase> {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, IDB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _idbPromise;
}

async function idbGet(key: string): Promise<LearningProfile | null> {
  try {
    const db = await openIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as LearningProfile) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: LearningProfile): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fail silently
  }
}

// ── createLearningProfile ─────────────────────────────────────────────

export function createLearningProfile(opts?: CrossSessionOptions): LearningProfileStore {
  const storageType = opts?.storage ?? 'localStorage';
  const userId = opts?.userId;
  const ttlDays = opts?.ttl ?? DEFAULT_TTL_DAYS;
  const key = profileKey(userId);

  // Load initial profile synchronously if using localStorage
  let initial: LearningProfile = makeEmptyProfile(userId);

  if (storageType === 'localStorage') {
    const stored = lsGet(key);
    if (stored && !isExpired(stored, ttlDays)) {
      initial = stored;
    }
  }

  const _profile = signal<LearningProfile>(initial);

  // For indexedDB and custom, load asynchronously and update signal
  if (storageType === 'indexedDB' && typeof indexedDB !== 'undefined') {
    idbGet(key).then((stored) => {
      if (stored && !isExpired(stored, ttlDays)) {
        _profile.set(stored);
      }
    }).catch(() => {});
  } else if (storageType === 'custom' && opts?.customStorage) {
    opts.customStorage.get(key).then((stored) => {
      const p = stored as LearningProfile | null;
      if (p && !isExpired(p, ttlDays)) {
        _profile.set(p);
      }
    }).catch(() => {});
  }

  // Persist on every change
  effect(() => {
    const p = _profile();
    if (storageType === 'localStorage') {
      lsSet(key, p);
    } else if (storageType === 'indexedDB' && typeof indexedDB !== 'undefined') {
      idbSet(key, p).catch(() => {});
    } else if (storageType === 'custom' && opts?.customStorage) {
      opts.customStorage.set(key, p).catch(() => {});
    }
  });

  function updateProfile(updater: (p: LearningProfile) => LearningProfile): void {
    const next = updater(_profile.peek());
    next.updatedAt = Date.now();
    _profile.set(next);
  }

  const store: LearningProfileStore = {
    profile: () => _profile(),

    record(action: string, value?: unknown): void {
      updateProfile((p) => {
        const patterns = [...p.patterns];
        const existing = patterns.find((pat) => pat.action === action);
        if (existing) {
          existing.frequency++;
          existing.lastSeen = Date.now();
        } else {
          patterns.push({ action, frequency: 1, lastSeen: Date.now() });
        }

        // Track value as preference if provided
        const preferences = { ...p.preferences };
        if (value !== undefined) {
          preferences[action] = value;
        }

        return { ...p, patterns, preferences };
      });
    },

    adapt<T>(key: string, defaultValue: T): () => T {
      return computed(() => {
        const p = _profile();
        const val = p.adaptations[key];
        if (val !== undefined) return val as T;
        const pref = p.preferences[key];
        if (pref !== undefined) return pref as T;
        return defaultValue;
      });
    },

    reset(): void {
      _profile.set(makeEmptyProfile(userId));
      // Clear from storage
      if (storageType === 'localStorage' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    },

    export(): LearningProfile {
      // Deep clone so mutations to the returned object don't affect the store
      return JSON.parse(JSON.stringify(_profile.peek())) as LearningProfile;
    },

    import(profile: LearningProfile): void {
      _profile.set({ ...profile, updatedAt: Date.now() });
    },
  };

  return store;
}

// ── adaptiveSignal ─────────────────────────────────────────────────────

export type AdaptiveSignalOptions = CrossSessionOptions & { key: string };

export function adaptiveSignal<T>(
  initial: T,
  optsOrKey: string | AdaptiveSignalOptions,
  legacyOpts?: CrossSessionOptions,
): AdaptiveSignalType<T> {
  // Support both old-style (initial, key, opts?) and new-style (initial, { key, ...opts })
  const resolvedKey = typeof optsOrKey === 'string' ? optsOrKey : optsOrKey.key;
  const opts = typeof optsOrKey === 'string' ? legacyOpts : optsOrKey;
  const key = resolvedKey;

  const storageType = opts?.storage ?? 'localStorage';
  const storageKey = `__drishti_adaptive_${key}__`;
  const ttlDays = opts?.ttl ?? DEFAULT_TTL_DAYS;

  interface AdaptiveState {
    current: T;
    valueCounts: Array<{ value: T; frequency: number }>;
    lastUpdated: number;
  }

  function loadState(): AdaptiveState | null {
    if (storageType !== 'localStorage') return null;
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AdaptiveState;
      const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.lastUpdated > ttlMs) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveState(state: AdaptiveState): void {
    if (storageType !== 'localStorage') return;
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Fail silently
    }
  }

  const loaded = loadState();
  const initialState: AdaptiveState = loaded ?? {
    current: initial,
    valueCounts: [],
    lastUpdated: Date.now(),
  };

  const _state = signal<AdaptiveState>(initialState);

  // Persist on change
  effect(() => {
    saveState(_state());
  });

  function findPreferred(): T {
    const counts = _state.peek().valueCounts;
    if (counts.length === 0) return _state.peek().current;
    const best = counts.reduce((a, b) => (b.frequency > a.frequency ? b : a));
    return best.value;
  }

  const sig = Object.assign(
    function (): T {
      return _state().current;
    },
    {
      peek: () => _state.peek().current,

      set(value: T): void {
        const current = _state.peek();
        const counts = [...current.valueCounts];
        const existing = counts.find((c) => Object.is(c.value, value));
        if (existing) {
          existing.frequency++;
        } else {
          counts.push({ value, frequency: 1 });
        }
        _state.set({
          current: value,
          valueCounts: counts,
          lastUpdated: Date.now(),
        });
      },

      subscribe: (fn: (value: T) => void): (() => void) => {
        const unsub = _state.subscribe((s) => fn(s.current));
        return unsub;
      },

      preferred: () => findPreferred(),

      frequencies: (): Array<{ value: T; frequency: number }> => {
        return [..._state().valueCounts].sort((a, b) => b.frequency - a.frequency);
      },
    },
  ) as AdaptiveSignalType<T>;

  return sig;
}
