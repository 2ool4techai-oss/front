export interface PreferenceOptions<T> {
  key: string;
  behavioral?: number;
  explicit?: number;
  fallback: T;
}

export interface PreferenceSignal<T> {
  (): T;
  set: (v: T) => void;
  observe: (v: T) => void;
  explicit: () => T | null;
  behavioral: () => T | null;
  confidence: () => number;
  reset: () => void;
}

interface ExplicitPref<T> {
  value: T;
  ts: number;
}

type BehavioralMap<T> = Array<[T, number]>;

function storageKey(key: string, suffix: string): string {
  return `__pref_${key}_${suffix}`;
}

function loadExplicit<T>(key: string): ExplicitPref<T> | null {
  try {
    const raw = localStorage.getItem(storageKey(key, 'explicit'));
    if (!raw) return null;
    return JSON.parse(raw) as ExplicitPref<T>;
  } catch {
    return null;
  }
}

function saveExplicit<T>(key: string, pref: ExplicitPref<T>): void {
  try {
    localStorage.setItem(storageKey(key, 'explicit'), JSON.stringify(pref));
  } catch {
    // ignore
  }
}

function loadBehavioral<T>(key: string): Map<string, { value: T; count: number }> {
  try {
    const raw = localStorage.getItem(storageKey(key, 'behavioral'));
    if (!raw) return new Map();
    const pairs: Array<[string, { value: T; count: number }]> = JSON.parse(raw);
    return new Map(pairs);
  } catch {
    return new Map();
  }
}

function saveBehavioral<T>(key: string, map: Map<string, { value: T; count: number }>): void {
  try {
    const pairs = Array.from(map.entries());
    localStorage.setItem(storageKey(key, 'behavioral'), JSON.stringify(pairs));
  } catch {
    // ignore
  }
}

function serialize(v: unknown): string {
  return JSON.stringify(v);
}

function getBehavioralWinner<T>(
  map: Map<string, { value: T; count: number }>,
): { value: T; count: number; runnerUpCount: number } | null {
  if (map.size === 0) return null;
  const entries = Array.from(map.values()).sort((a, b) => b.count - a.count);
  const winner = entries[0]!;
  const runnerUp = entries[1];
  return {
    value: winner.value,
    count: winner.count,
    runnerUpCount: runnerUp?.count ?? 0,
  };
}

export function preferenceSignal<T>(opts: PreferenceOptions<T>): PreferenceSignal<T> {
  const _behavioralWeight = opts.behavioral ?? 0.4;
  const _explicitWeight = opts.explicit ?? 1.0;
  void _behavioralWeight;
  void _explicitWeight;

  let explicitPref: ExplicitPref<T> | null = loadExplicit<T>(opts.key);
  let behavioralMap: Map<string, { value: T; count: number }> = loadBehavioral<T>(opts.key);

  const sig = function (): T {
    if (explicitPref !== null) {
      return explicitPref.value;
    }
    const winner = getBehavioralWinner(behavioralMap);
    if (winner && winner.count >= 3) {
      return winner.value;
    }
    return opts.fallback;
  } as PreferenceSignal<T>;

  sig.set = function (v: T): void {
    explicitPref = { value: v, ts: Date.now() };
    saveExplicit(opts.key, explicitPref);
  };

  sig.observe = function (v: T): void {
    const key = serialize(v);
    const existing = behavioralMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      behavioralMap.set(key, { value: v, count: 1 });
    }
    saveBehavioral(opts.key, behavioralMap);
  };

  sig.explicit = function (): T | null {
    return explicitPref?.value ?? null;
  };

  sig.behavioral = function (): T | null {
    const winner = getBehavioralWinner(behavioralMap);
    if (winner && winner.count >= 3) {
      return winner.value;
    }
    return null;
  };

  sig.confidence = function (): number {
    if (explicitPref !== null) return 1.0;
    const winner = getBehavioralWinner(behavioralMap);
    if (!winner || winner.count === 0) return 0;
    const denom = winner.count + winner.runnerUpCount + 1;
    return winner.count / denom;
  };

  sig.reset = function (): void {
    explicitPref = null;
    behavioralMap = new Map();
    try {
      localStorage.removeItem(storageKey(opts.key, 'explicit'));
      localStorage.removeItem(storageKey(opts.key, 'behavioral'));
    } catch {
      // ignore
    }
  };

  return sig;
}
