import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { preferenceSignal } from '../preference.js';

const _store: Record<string, string> = {};
const mockStorage = {
  getItem:    (k: string) => _store[k] ?? null,
  setItem:    (k: string, v: string) => { _store[k] = v; },
  removeItem: (k: string) => { delete _store[k]; },
};

beforeEach(() => {
  for (const k of Object.keys(_store)) delete _store[k];
  vi.stubGlobal('localStorage', mockStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('preferenceSignal', () => {
  it('returns fallback when nothing is set', () => {
    const sig = preferenceSignal({ key: 'test1', fallback: 'default' });
    expect(sig()).toBe('default');
  });

  it('explicit() returns null initially', () => {
    const sig = preferenceSignal({ key: 'test2', fallback: 'x' });
    expect(sig.explicit()).toBeNull();
  });

  it('behavioral() returns null initially', () => {
    const sig = preferenceSignal({ key: 'test3', fallback: 'x' });
    expect(sig.behavioral()).toBeNull();
  });

  it('set() records explicit preference', () => {
    const sig = preferenceSignal({ key: 'test4', fallback: 'default' });
    sig.set('dark');
    expect(sig()).toBe('dark');
    expect(sig.explicit()).toBe('dark');
  });

  it('explicit preference wins over behavioral', () => {
    const sig = preferenceSignal({ key: 'test5', fallback: 'fallback' });
    // Build up behavioral evidence
    for (let i = 0; i < 5; i++) sig.observe('light');
    // Set explicit
    sig.set('dark');
    expect(sig()).toBe('dark');
  });

  it('confidence() returns 1.0 when explicit is set', () => {
    const sig = preferenceSignal({ key: 'test6', fallback: 'x' });
    sig.set('y');
    expect(sig.confidence()).toBe(1.0);
  });

  it('observe() accumulates behavioral counts', () => {
    const sig = preferenceSignal({ key: 'test7', fallback: 'fallback' });
    sig.observe('compact');
    sig.observe('compact');
    sig.observe('compact');
    expect(sig.behavioral()).toBe('compact');
    expect(sig()).toBe('compact');
  });

  it('behavioral() returns null when count < 3', () => {
    const sig = preferenceSignal({ key: 'test8', fallback: 'fallback' });
    sig.observe('val');
    sig.observe('val');
    expect(sig.behavioral()).toBeNull();
    expect(sig()).toBe('fallback');
  });

  it('confidence() is 0 with no data', () => {
    const sig = preferenceSignal({ key: 'test9', fallback: 'x' });
    expect(sig.confidence()).toBe(0);
  });

  it('confidence() reflects winner vs runner-up ratio', () => {
    const sig = preferenceSignal({ key: 'test10', fallback: 'x' });
    sig.observe('a');
    sig.observe('a');
    sig.observe('a');
    sig.observe('b');
    // winner=3, runnerUp=1, denom=5 → 3/5 = 0.6
    expect(sig.confidence()).toBeCloseTo(3 / 5, 5);
  });

  it('reset() clears explicit and behavioral data', () => {
    const sig = preferenceSignal({ key: 'test11', fallback: 'fallback' });
    sig.set('explicit');
    sig.observe('behavioral');
    sig.observe('behavioral');
    sig.observe('behavioral');
    sig.reset();
    expect(sig()).toBe('fallback');
    expect(sig.explicit()).toBeNull();
    expect(sig.behavioral()).toBeNull();
  });

  it('persists explicit preference across instances', () => {
    const sig1 = preferenceSignal({ key: 'persist1', fallback: 'none' });
    sig1.set('remembered');
    const sig2 = preferenceSignal({ key: 'persist1', fallback: 'none' });
    expect(sig2()).toBe('remembered');
  });

  it('persists behavioral observations across instances', () => {
    const sig1 = preferenceSignal({ key: 'persist2', fallback: 'none' });
    sig1.observe('x');
    sig1.observe('x');
    sig1.observe('x');
    const sig2 = preferenceSignal({ key: 'persist2', fallback: 'none' });
    expect(sig2()).toBe('x');
  });

  it('winner is the value with most observations', () => {
    const sig = preferenceSignal({ key: 'test-winner', fallback: 'fallback' });
    sig.observe('a');
    sig.observe('a');
    sig.observe('a');
    sig.observe('b');
    sig.observe('b');
    sig.observe('b');
    sig.observe('b');
    expect(sig.behavioral()).toBe('b');
  });
});
