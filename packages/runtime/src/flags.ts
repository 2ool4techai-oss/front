import { signal, computed } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type FlagVariant = string | boolean | number;

export interface FlagConfig<T extends FlagVariant = boolean> {
  defaultValue: T;
  variants?:    readonly T[];
  rollout?:     number;
  userId?:      string;
  override?:    T;
}

export interface FlagHandle<T extends FlagVariant> {
  readonly value:   ComputedSignal<T>;
  readonly variant: ComputedSignal<string>;
  isEnabled(): boolean;
  track(event: string, props?: Record<string, unknown>): void;
  override(value: T): void;
  reset(): void;
}

// ── djb2 hash ─────────────────────────────────────────────────────────

function djb2(str: string): number {
  let h = 5381;
  for (const c of str) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return (h >>> 0) / 0xFFFFFFFF;
}

// ── createFlag ─────────────────────────────────────────────────────────

export function createFlag<T extends FlagVariant>(
  key: string,
  config: FlagConfig<T>,
): FlagHandle<T> {
  const storageKey = `dr_flag_${key}`;

  // Internal override signal
  const _override = signal<T | null>(null);

  // Load from localStorage on init
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        _override.set(JSON.parse(stored) as T);
      } else if (config.override !== undefined) {
        _override.set(config.override);
      }
    } catch {
      if (config.override !== undefined) {
        _override.set(config.override);
      }
    }
  } else if (config.override !== undefined) {
    _override.set(config.override);
  }

  function computeAssigned(): T {
    const rollout = config.rollout ?? 1;
    const userId  = config.userId ?? '';

    if (rollout <= 0) return config.defaultValue;
    if (rollout >= 1) {
      // Fully enabled — pick from variants if available
      if (config.variants && config.variants.length > 0) {
        const hash = djb2(userId + key);
        const idx  = Math.floor(hash * config.variants.length);
        return config.variants[Math.min(idx, config.variants.length - 1)] as T;
      }
      return config.defaultValue;
    }

    const hash = djb2(userId + key);
    if (hash > rollout) return config.defaultValue;

    if (config.variants && config.variants.length > 0) {
      const idx = Math.floor(hash * config.variants.length);
      return config.variants[Math.min(idx, config.variants.length - 1)] as T;
    }
    return config.defaultValue;
  }

  const value = computed<T>(() => {
    const ov = _override();
    if (ov !== null) return ov;
    return computeAssigned();
  });

  const variant = computed<string>(() => {
    const v = value();
    if (typeof v === 'boolean') return v ? 'enabled' : 'disabled';
    return String(v);
  });

  function isEnabled(): boolean {
    const v = value();
    if (typeof v === 'boolean') return v;
    return v !== config.defaultValue;
  }

  function track(event: string, props?: Record<string, unknown>): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dr:flag:track', {
          detail: { flag: key, event, variant: variant(), props },
        }),
      );
    }
  }

  function override(val: T): void {
    _override.set(val);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(val));
      } catch {
        // ignore storage errors
      }
    }
  }

  function reset(): void {
    _override.set(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }

  return { value, variant, isEnabled, track, override, reset };
}

// ── createFlagStore ────────────────────────────────────────────────────

export function createFlagStore(flags: Record<string, FlagConfig<FlagVariant>>): {
  get<T extends FlagVariant>(key: string): FlagHandle<T>;
  getAll(): Record<string, FlagVariant>;
  setUserId(id: string): void;
} {
  let userId = '';
  const handles = new Map<string, FlagHandle<FlagVariant>>();

  function ensureHandle(key: string): FlagHandle<FlagVariant> {
    let h = handles.get(key);
    if (!h) {
      const cfg = flags[key];
      if (!cfg) throw new Error(`Flag "${key}" not found in store`);
      h = createFlag(key, { ...cfg, userId });
      handles.set(key, h);
    }
    return h;
  }

  function get<T extends FlagVariant>(key: string): FlagHandle<T> {
    return ensureHandle(key) as FlagHandle<T>;
  }

  function getAll(): Record<string, FlagVariant> {
    const result: Record<string, FlagVariant> = {};
    for (const key of Object.keys(flags)) {
      result[key] = ensureHandle(key).value();
    }
    return result;
  }

  function setUserId(id: string): void {
    userId = id;
    // Re-create handles with new userId
    handles.clear();
    for (const key of Object.keys(flags)) {
      flags[key] = { ...flags[key]!, userId: id };
    }
  }

  return { get, getAll, setUserId };
}
