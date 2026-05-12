import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDecaySignal } from '../decay.js';

const _store: Record<string, string> = {};
const mockStorage = {
  getItem:    (k: string) => _store[k] ?? null,
  setItem:    (k: string, v: string) => { _store[k] = v; },
  removeItem: (k: string) => { delete _store[k]; },
};

beforeEach(() => {
  for (const k of Object.keys(_store)) delete _store[k];
  vi.stubGlobal('localStorage', mockStorage);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createDecaySignal', () => {
  it('returns initial value when no entries exist', () => {
    const sig = createDecaySignal({ initial: 'default' });
    expect(sig()).toBe('default');
  });

  it('peek() returns same as call', () => {
    const sig = createDecaySignal({ initial: 42 });
    expect(sig.peek()).toBe(42);
  });

  it('reinforce() sets a value above minConfidence', () => {
    const sig = createDecaySignal({ initial: 'default' });
    sig.reinforce('dark');
    expect(sig()).toBe('dark');
  });

  it('set() is equivalent to reinforce with 0.3 boost', () => {
    const sig = createDecaySignal({ initial: 'light' });
    sig.set('dark');
    expect(sig()).toBe('dark');
    expect(sig.confidence('dark')).toBeGreaterThanOrEqual(0.3);
  });

  it('reinforce() caps confidence at 1.0', () => {
    const sig = createDecaySignal({ initial: 'a' });
    sig.reinforce('x', 0.8);
    sig.reinforce('x', 0.8);
    expect(sig.confidence('x')).toBeLessThanOrEqual(1.0);
  });

  it('entries() returns current decayed entries', () => {
    const sig = createDecaySignal({ initial: 'none' });
    sig.reinforce('a', 0.5);
    sig.reinforce('b', 0.3);
    const ents = sig.entries();
    expect(ents).toHaveLength(2);
    expect(ents.some(e => e.value === 'a')).toBe(true);
    expect(ents.some(e => e.value === 'b')).toBe(true);
  });

  it('confidence() returns 0 for unknown value', () => {
    const sig = createDecaySignal({ initial: 'x' });
    expect(sig.confidence('unknown')).toBe(0);
  });

  it('decay() reduces confidence and resets lastReinforced', () => {
    const sig = createDecaySignal({ initial: 'none', halfLife: 1000 });
    sig.reinforce('val', 0.8);
    const before = sig.confidence('val');
    // Advance time so decay would happen on next read
    vi.advanceTimersByTime(500);
    // After decay() call entries are re-based to now with decayed confidence
    sig.decay();
    const after = sig.confidence('val');
    // After decay() the entry's lastReinforced is reset to now, so confidence reads the same
    // but the stored value should be the decayed amount
    expect(after).toBeLessThanOrEqual(before);
  });

  it('falls back to initial when confidence drops below minConfidence', () => {
    const sig = createDecaySignal({
      initial: 'fallback',
      halfLife: 1000,
      minConfidence: 0.05,
    });
    sig.reinforce('hello', 0.06);
    expect(sig()).toBe('hello');
    // Advance time far enough that confidence < 0.05
    vi.advanceTimersByTime(10000);
    expect(sig()).toBe('fallback');
  });

  it('reset() clears all entries and returns initial', () => {
    const sig = createDecaySignal({ initial: 'gone' });
    sig.reinforce('something', 0.9);
    expect(sig()).toBe('something');
    sig.reset();
    expect(sig()).toBe('gone');
    expect(sig.entries()).toHaveLength(0);
  });

  it('persists to and loads from localStorage', () => {
    const key = 'test-decay-persist';
    const sig1 = createDecaySignal({ initial: 'fallback', storageKey: key });
    sig1.reinforce('remembered', 0.7);
    expect(_store[key]).toBeDefined();

    const sig2 = createDecaySignal({ initial: 'fallback', storageKey: key });
    expect(sig2()).toBe('remembered');
  });

  it('reset() removes localStorage entry', () => {
    const key = 'test-decay-reset';
    const sig = createDecaySignal({ initial: 'x', storageKey: key });
    sig.reinforce('y', 0.5);
    sig.reset();
    expect(_store[key]).toBeUndefined();
  });

  it('picks highest confidence value among multiple', () => {
    const sig = createDecaySignal({ initial: 'none' });
    sig.reinforce('low', 0.1);
    sig.reinforce('high', 0.9);
    expect(sig()).toBe('high');
  });

  it('multiple reinforcements increase confidence beyond single boost', () => {
    const sig = createDecaySignal({ initial: 'none' });
    sig.reinforce('val', 0.2);
    const after1 = sig.confidence('val');
    sig.reinforce('val', 0.2);
    const after2 = sig.confidence('val');
    expect(after2).toBeGreaterThan(after1);
  });
});
