const DEFAULT_HALF_LIFE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const DEFAULT_MIN_CONFIDENCE = 0.05;

export interface DecayOptions<T> {
  halfLife?: number;
  minConfidence?: number;
  storageKey?: string;
  initial: T;
}

export interface DecayEntry<T> {
  value: T;
  confidence: number;
  lastReinforced: number;
}

export interface DecaySignal<T> {
  (): T;
  set: (v: T) => void;
  peek: () => T;
  reinforce: (v: T, boost?: number) => void;
  decay: () => void;
  entries: () => DecayEntry<T>[];
  confidence: (v: T) => number;
  reset: () => void;
}

function serializeKey(v: unknown): string {
  return JSON.stringify(v);
}

function applyDecay(entry: DecayEntry<unknown>, halfLife: number, now: number): number {
  const elapsed = now - entry.lastReinforced;
  return entry.confidence * Math.pow(0.5, elapsed / halfLife);
}

function loadFromStorage<T>(storageKey: string): Map<string, DecayEntry<T>> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Map();
    const pairs: Array<[string, DecayEntry<T>]> = JSON.parse(raw);
    return new Map(pairs);
  } catch {
    return new Map();
  }
}

function saveToStorage<T>(storageKey: string, map: Map<string, DecayEntry<T>>): void {
  try {
    const pairs = Array.from(map.entries());
    localStorage.setItem(storageKey, JSON.stringify(pairs));
  } catch {
    // ignore storage errors
  }
}

export function createDecaySignal<T>(opts: DecayOptions<T>): DecaySignal<T> {
  const halfLife = opts.halfLife ?? DEFAULT_HALF_LIFE;
  const minConfidence = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const storageKey = opts.storageKey;

  // Map from serialized key → entry (the entry.value holds the original T)
  let store: Map<string, DecayEntry<T>>;

  if (storageKey) {
    store = loadFromStorage<T>(storageKey);
  } else {
    store = new Map();
  }

  function persist(): void {
    if (storageKey) {
      saveToStorage(storageKey, store);
    }
  }

  function getCurrentConfidence(serializedKey: string): number {
    const entry = store.get(serializedKey);
    if (!entry) return 0;
    return applyDecay(entry as DecayEntry<unknown>, halfLife, Date.now());
  }

  function getBestValue(): T {
    let bestKey: string | null = null;
    let bestConf = -1;

    for (const [key] of store) {
      const conf = getCurrentConfidence(key);
      if (conf > bestConf) {
        bestConf = conf;
        bestKey = key;
      }
    }

    if (bestKey !== null && bestConf >= minConfidence) {
      return store.get(bestKey)!.value;
    }
    return opts.initial;
  }

  const sig = function (): T {
    return getBestValue();
  } as DecaySignal<T>;

  sig.peek = function (): T {
    return getBestValue();
  };

  sig.reinforce = function (v: T, boost: number = 0.2): void {
    const key = serializeKey(v);
    const existing = store.get(key);
    const now = Date.now();

    if (existing) {
      const currentConf = applyDecay(existing as DecayEntry<unknown>, halfLife, now);
      existing.confidence = Math.min(1.0, currentConf + boost);
      existing.lastReinforced = now;
    } else {
      store.set(key, {
        value: v,
        confidence: Math.min(1.0, boost),
        lastReinforced: now,
      });
    }
    persist();
  };

  sig.set = function (v: T): void {
    sig.reinforce(v, 0.3);
  };

  sig.decay = function (): void {
    const now = Date.now();
    for (const [key, entry] of store) {
      const decayed = applyDecay(entry as DecayEntry<unknown>, halfLife, now);
      entry.confidence = decayed;
      entry.lastReinforced = now;
    }
    persist();
  };

  sig.entries = function (): DecayEntry<T>[] {
    const now = Date.now();
    return Array.from(store.values()).map((entry) => ({
      value: entry.value,
      confidence: applyDecay(entry as DecayEntry<unknown>, halfLife, now),
      lastReinforced: entry.lastReinforced,
    }));
  };

  sig.confidence = function (v: T): number {
    const key = serializeKey(v);
    return getCurrentConfidence(key);
  };

  sig.reset = function (): void {
    store.clear();
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  };

  return sig;
}
