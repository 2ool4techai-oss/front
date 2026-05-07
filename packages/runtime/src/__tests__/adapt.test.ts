import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAdaptSignal } from '../adapt.js';

// Mock localStorage
const _store: Record<string, string> = {};
const mockStorage = {
  getItem:    (k: string) => _store[k] ?? null,
  setItem:    (k: string, v: string) => { _store[k] = v; },
  removeItem: (k: string) => { delete _store[k]; },
};

beforeEach(() => {
  // Clear the store before each test
  for (const k of Object.keys(_store)) delete _store[k];
  vi.stubGlobal('localStorage', mockStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAdaptSignal', () => {
  it('starts with initial value', () => {
    const sig = createAdaptSignal('test-init', 'light');
    expect(sig()).toBe('light');
    expect(sig.peek()).toBe('light');
  });

  it('adapt() records observations', () => {
    const sig = createAdaptSignal('test-obs', 'light');
    sig.adapt('dark');
    sig.adapt('dark');
    expect(sig.observations).toHaveLength(2);
    expect(sig.observations[0]!.value).toBe('dark');
    expect(sig.observations[0]!.timestamp).toBeGreaterThan(0);
  });

  it('auto-adapts when threshold reached with enough observations', () => {
    const sig = createAdaptSignal('test-adapt', 'light', {
      minObservations: 3,
      threshold: 0.5,
    });
    // Provide enough observations for 'dark' to dominate
    sig.adapt('dark');
    sig.adapt('dark');
    sig.adapt('dark');
    // Signal should have adapted to 'dark'
    expect(sig()).toBe('dark');
  });

  it('does not adapt before minObservations', () => {
    const sig = createAdaptSignal('test-min-obs', 'light', {
      minObservations: 5,
      threshold: 0.5,
    });
    sig.adapt('dark');
    sig.adapt('dark');
    sig.adapt('dark');
    // Only 3 observations, minimum is 5
    expect(sig()).toBe('light');
  });

  it('confidence property reflects current score', () => {
    const sig = createAdaptSignal('test-confidence', 'light', {
      minObservations: 3,
      threshold: 0.99, // Very high threshold so it won't auto-adapt
    });
    // Before enough observations
    expect(sig.confidence).toBe(0);

    sig.adapt('dark');
    sig.adapt('dark');
    sig.adapt('dark');
    // After enough observations, confidence should be updated
    expect(sig.confidence).toBeGreaterThan(0);
  });

  it('predict() returns best value without changing signal', () => {
    const sig = createAdaptSignal('test-predict', 'light', {
      minObservations: 10,
      threshold: 0.9,
    });
    sig.adapt('dark');
    sig.adapt('dark');
    sig.adapt('dark');

    const prediction = sig.predict();
    expect(prediction).not.toBeNull();
    expect(prediction!.value).toBe('dark');
    expect(prediction!.confidence).toBeGreaterThan(0);

    // Signal should still have the initial value (threshold not reached)
    expect(sig()).toBe('light');
  });

  it('reset() clears observations and restores initial value', () => {
    const sig = createAdaptSignal('test-reset', 'light', {
      minObservations: 3,
      threshold: 0.5,
    });
    sig.adapt('dark');
    sig.adapt('dark');
    sig.adapt('dark');
    expect(sig()).toBe('dark');

    sig.reset();
    expect(sig()).toBe('light');
    expect(sig.observations).toHaveLength(0);
    expect(sig.confidence).toBe(0);
  });

  it('persists observations to localStorage', () => {
    const sig = createAdaptSignal('test-persist', 'light');
    sig.adapt('dark');

    const stored = mockStorage.getItem('dr_adapt_test-persist');
    expect(stored).not.toBeNull();
    const data = JSON.parse(stored!);
    expect(data.observations).toHaveLength(1);
    expect(data.observations[0].value).toBe('dark');
  });

  it('loads observations from localStorage on creation', () => {
    // Pre-populate localStorage with observations
    const observations = [
      { value: 'compact', timestamp: Date.now() - 1000, weight: 1 },
      { value: 'compact', timestamp: Date.now() - 500, weight: 1 },
      { value: 'compact', timestamp: Date.now() - 100, weight: 1 },
    ];
    mockStorage.setItem('dr_adapt_test-load', JSON.stringify({ observations }));

    const sig = createAdaptSignal<string>('test-load', 'normal', {
      minObservations: 3,
      threshold: 0.5,
    });

    // Should have loaded the observations
    expect(sig.observations).toHaveLength(3);
    // Should have auto-adapted since we have enough observations
    expect(sig()).toBe('compact');
  });

  it('custom scorer is used when provided', () => {
    const customScorer = vi.fn((observations: Array<{ value: string; timestamp: number; weight?: number }>) => {
      // Always return 'custom' as the winner
      const scores = new Map<string, number>();
      scores.set('custom', 1.0);
      for (const obs of observations) {
        if (obs.value !== 'custom') scores.set(obs.value, 0.1);
      }
      return scores;
    });

    const sig = createAdaptSignal('test-custom-scorer', 'light', {
      minObservations: 3,
      threshold: 0.9,
      scorer: customScorer as unknown as (obs: Array<{ value: string; timestamp: number; weight?: number }>) => Map<string, number>,
    });

    sig.adapt('light');
    sig.adapt('light');
    sig.adapt('light');

    expect(customScorer).toHaveBeenCalled();
    expect(sig()).toBe('custom');
  });

  it('onAdapt callback fires when value changes', () => {
    const onAdapt = vi.fn();
    const sig = createAdaptSignal<string>('test-on-adapt', 'light', {
      minObservations: 3,
      threshold: 0.5,
      onAdapt,
    });

    sig.adapt('dark');
    sig.adapt('dark');
    sig.adapt('dark');

    expect(onAdapt).toHaveBeenCalledWith('dark', expect.any(Number));
  });

  it('rolling window trims oldest when windowSize exceeded', () => {
    const sig = createAdaptSignal('test-window', 'a', {
      windowSize: 3,
    });

    sig.adapt('x');
    sig.adapt('y');
    sig.adapt('z');
    // This should trim the oldest 'x'
    sig.adapt('w');

    expect(sig.observations).toHaveLength(3);
    // The oldest 'x' should be gone
    expect(sig.observations.find(o => o.value === 'x')).toBeUndefined();
    expect(sig.observations[0]!.value).toBe('y');
    expect(sig.observations[1]!.value).toBe('z');
    expect(sig.observations[2]!.value).toBe('w');
  });

  it('persist: false skips localStorage', () => {
    const sig = createAdaptSignal('test-no-persist', 'light', {
      persist: false,
    });

    sig.adapt('dark');

    const stored = mockStorage.getItem('dr_adapt_test-no-persist');
    expect(stored).toBeNull();
    // Observations should still be tracked in memory
    expect(sig.observations).toHaveLength(1);
  });

  it('weight parameter influences scoring', () => {
    const sig = createAdaptSignal<string>('test-weight', 'light', {
      minObservations: 3,
      threshold: 0.5,
    });

    // 'light' gets 2 observations but with low weight
    sig.adapt('light', 0.1);
    sig.adapt('light', 0.1);
    // 'dark' gets 1 observation with high weight
    sig.adapt('dark', 100);

    // High-weight 'dark' observation should win
    expect(sig()).toBe('dark');
  });

  it('predict() returns null when no observations', () => {
    const sig = createAdaptSignal('test-predict-empty', 'light');
    const result = sig.predict();
    expect(result).toBeNull();
  });

  it('reset() removes persisted data from localStorage', () => {
    const sig = createAdaptSignal('test-reset-persist', 'light');
    sig.adapt('dark');

    // Verify data is persisted
    expect(mockStorage.getItem('dr_adapt_test-reset-persist')).not.toBeNull();

    sig.reset();

    // After reset, data should be removed from storage
    expect(mockStorage.getItem('dr_adapt_test-reset-persist')).toBeNull();
  });
});
