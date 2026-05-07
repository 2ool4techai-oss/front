import { signal } from './signal.js';
import type { Signal, SignalSubscriber, Unsubscribe } from './types.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface AdaptOptions<T> {
  /** Minimum number of observations before adapting. Default: 5 */
  minObservations?: number;
  /** Confidence threshold 0–1 before auto-switching. Default: 0.7 */
  threshold?:       number;
  /** Max observations to keep in memory (rolling window). Default: 50 */
  windowSize?:      number;
  /** Storage key prefix. Default: 'dr_adapt' */
  storageKey?:      string;
  /** Custom scoring function — return score map {value: score} */
  scorer?:          (observations: AdaptObservation<T>[]) => Map<T, number>;
  /** If false, don't persist to localStorage. Default: true */
  persist?:         boolean;
  /** Called when the signal auto-adapts to a new value */
  onAdapt?:         (value: T, confidence: number) => void;
}

export interface AdaptObservation<T> {
  value:     T;
  timestamp: number;
  /** Higher weight = more recent or explicit. Default 1.0 */
  weight?:   number;
}

export interface AdaptSignal<T> extends Signal<T> {
  /** Record that the user chose/used this value */
  adapt(value: T, weight?: number): void;
  /** Current confidence score for the active value (0–1) */
  readonly confidence: number;
  /** All recorded observations */
  readonly observations: readonly AdaptObservation<T>[];
  /** Reset all learned data */
  reset(): void;
  /** Get the predicted best value without applying it */
  predict(): { value: T; confidence: number } | null;
}

// ── Storage helpers ───────────────────────────────────────────────────

interface StorageData<T> {
  observations: AdaptObservation<T>[];
}

function loadFromStorage<T>(storageKey: string): AdaptObservation<T>[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return [];
    const data = JSON.parse(raw) as StorageData<T>;
    return Array.isArray(data.observations) ? data.observations : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(storageKey: string, observations: AdaptObservation<T>[]): void {
  try {
    const data: StorageData<T> = { observations };
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // Quota exceeded or private browsing — fail silently
  }
}

// ── Built-in scorer ───────────────────────────────────────────────────

function defaultScorer<T>(observations: AdaptObservation<T>[]): Map<T, number> {
  const scores = new Map<T, number>();
  const now = Date.now();

  for (const obs of observations) {
    const weight = obs.weight ?? 1.0;
    const recencyFactor = 1 / (1 + (now - obs.timestamp) / 86400000);
    const score = weight * recencyFactor;
    const existing = scores.get(obs.value) ?? 0;
    scores.set(obs.value, existing + score);
  }

  // Normalize to 0–1 range
  if (scores.size === 0) return scores;

  const maxScore = Math.max(...scores.values());
  if (maxScore === 0) return scores;

  for (const [key, val] of scores) {
    scores.set(key, val / maxScore);
  }

  return scores;
}

// ── createAdaptSignal ─────────────────────────────────────────────────

export function createAdaptSignal<T>(
  key:     string,
  initial: T,
  opts?:   AdaptOptions<T>,
): AdaptSignal<T> {
  const minObservations = opts?.minObservations ?? 5;
  const threshold       = opts?.threshold       ?? 0.7;
  const windowSize      = opts?.windowSize      ?? 50;
  const storagePrefix   = opts?.storageKey      ?? 'dr_adapt';
  const scorer          = opts?.scorer          ?? defaultScorer;
  const shouldPersist   = opts?.persist !== false;
  const fullKey         = `${storagePrefix}_${key}`;

  // Load existing observations
  let observations: AdaptObservation<T>[] = shouldPersist
    ? loadFromStorage<T>(fullKey)
    : [];

  // Inner signal
  const inner = signal<T>(initial);

  // Track confidence
  let _confidence = 0;

  // Run scoring and potentially adapt the signal
  function runScorer(): void {
    if (observations.length < minObservations) return;

    const scores = scorer(observations);
    if (scores.size === 0) return;

    // Find the best value
    let bestValue: T | undefined;
    let bestScore = -Infinity;

    for (const [val, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestValue = val;
      }
    }

    if (bestValue === undefined) return;
    _confidence = bestScore;

    if (bestScore >= threshold) {
      const prev = inner.peek();
      inner.set(bestValue);
      if (!Object.is(prev, bestValue)) {
        opts?.onAdapt?.(bestValue, bestScore);
      }
    }
  }

  // Build the AdaptSignal by extending the inner signal
  // Use Object.defineProperties for getters so they always read live state
  const fn = function (): T { return inner(); };

  const methods = {
    peek: (): T => inner.peek(),

    set: (value: T): void => inner.set(value),

    subscribe: (fn: SignalSubscriber<T>): Unsubscribe => inner.subscribe(fn),

    adapt(value: T, weight?: number): void {
      const obs: AdaptObservation<T> = {
        value,
        timestamp: Date.now(),
        ...(weight !== undefined ? { weight } : {}),
      };
      observations.push(obs);

      // Trim rolling window
      if (observations.length > windowSize) {
        observations = observations.slice(observations.length - windowSize);
      }

      // Persist
      if (shouldPersist) {
        saveToStorage(fullKey, observations);
      }

      // Run scorer
      runScorer();
    },

    reset(): void {
      observations = [];
      _confidence = 0;
      if (shouldPersist) {
        try {
          localStorage.removeItem(fullKey);
        } catch {
          // fail silently
        }
      }
      inner.set(initial);
    },

    predict(): { value: T; confidence: number } | null {
      if (observations.length === 0) return null;

      const scores = scorer(observations);
      if (scores.size === 0) return null;

      let bestValue: T | undefined;
      let bestScore = -Infinity;

      for (const [val, score] of scores) {
        if (score > bestScore) {
          bestScore = score;
          bestValue = val;
        }
      }

      if (bestValue === undefined) return null;
      return { value: bestValue, confidence: bestScore };
    },
  };

  Object.assign(fn, methods);

  // Define getters via Object.defineProperties so they read live variable state
  Object.defineProperties(fn, {
    confidence: {
      get(): number { return _confidence; },
      enumerable: true,
      configurable: true,
    },
    observations: {
      get(): readonly AdaptObservation<T>[] { return observations; },
      enumerable: true,
      configurable: true,
    },
  });

  const adaptSig = fn as unknown as AdaptSignal<T>;

  // Run scorer on initial load (in case there are enough persisted observations)
  if (observations.length >= minObservations) {
    runScorer();
  }

  return adaptSig;
}

// ── useAdaptSignal ────────────────────────────────────────────────────

export function useAdaptSignal<T>(
  key:     string,
  initial: T,
  opts?:   AdaptOptions<T>,
): AdaptSignal<T> {
  return createAdaptSignal(key, initial, opts);
}
