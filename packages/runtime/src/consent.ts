import { signal, computed } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type ConsentCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export interface ConsentState {
  given:      boolean;
  categories: Record<ConsentCategory, boolean>;
  timestamp:  number | null;
  version:    string;
}

export interface ConsentOptions {
  storageKey?:        string;
  version?:           string;
  defaultCategories?: Partial<Record<ConsentCategory, boolean>>;
  onUpdate?:          (state: ConsentState) => void;
}

export interface ConsentHandle {
  readonly state:    Signal<ConsentState>;
  readonly given:    ComputedSignal<boolean>;
  readonly hasCategory: (cat: ConsentCategory) => boolean;
  acceptAll():  void;
  rejectAll():  void;
  update(cats: Partial<Record<ConsentCategory, boolean>>): void;
  withdraw():   void;
  reset():      void;
}

// ── Constants ──────────────────────────────────────────────────────────

const ALL_CATEGORIES: ConsentCategory[] = ['necessary', 'functional', 'analytics', 'marketing'];

function defaultState(version: string, defaults: Partial<Record<ConsentCategory, boolean>> = {}): ConsentState {
  return {
    given:     false,
    timestamp: null,
    version,
    categories: {
      necessary: true, // always on
      functional: defaults.functional  ?? false,
      analytics:  defaults.analytics   ?? false,
      marketing:  defaults.marketing   ?? false,
    },
  };
}

// ── Persistence helpers ────────────────────────────────────────────────

function loadFromStorage(key: string, version: string): ConsentState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== version) return null; // version mismatch → re-consent
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, state: ConsentState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // storage full or denied — ignore
  }
}

function removeFromStorage(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ── createConsentManager ───────────────────────────────────────────────

export function createConsentManager(opts: ConsentOptions = {}): ConsentHandle {
  const storageKey = opts.storageKey ?? 'drishti_consent';
  const version    = opts.version    ?? '1';

  const initial = loadFromStorage(storageKey, version)
    ?? defaultState(version, opts.defaultCategories);

  const _state = signal<ConsentState>(initial);

  const _given = computed<boolean>(() => _state().given);

  function commit(next: ConsentState): void {
    saveToStorage(storageKey, next);
    _state.set(next);
    opts.onUpdate?.(next);
  }

  const handle: ConsentHandle = {
    state: _state,
    given: _given,

    hasCategory(cat: ConsentCategory): boolean {
      return _state.peek().categories[cat] ?? false;
    },

    acceptAll(): void {
      const cats = {} as Record<ConsentCategory, boolean>;
      for (const c of ALL_CATEGORIES) cats[c] = true;
      commit({ given: true, timestamp: Date.now(), version, categories: cats });
    },

    rejectAll(): void {
      const cats: Record<ConsentCategory, boolean> = {
        necessary:  true,
        functional: false,
        analytics:  false,
        marketing:  false,
      };
      commit({ given: true, timestamp: Date.now(), version, categories: cats });
    },

    update(cats: Partial<Record<ConsentCategory, boolean>>): void {
      const current = _state.peek();
      const merged: Record<ConsentCategory, boolean> = {
        ...current.categories,
        ...cats,
        necessary: true, // necessary cannot be disabled
      };
      commit({ given: true, timestamp: Date.now(), version, categories: merged });
    },

    withdraw(): void {
      const fresh = defaultState(version, opts.defaultCategories);
      removeFromStorage(storageKey);
      _state.set(fresh);
      opts.onUpdate?.(fresh);
    },

    reset(): void {
      const fresh = defaultState(version, opts.defaultCategories);
      removeFromStorage(storageKey);
      _state.set(fresh);
    },
  };

  return handle;
}
