import { describe, it, expect, vi, beforeEach } from 'vitest';
import { offlineSignal, isOnline, onceOnline } from '../offline.js';

beforeEach(() => {
  localStorage.clear();
});

describe('offlineSignal', () => {
  it('initializes with given value', () => {
    const s = offlineSignal('hello', { key: 'test-key-1' });
    expect(s()).toBe('hello');
  });

  it('persists value to localStorage', () => {
    const s = offlineSignal(42, { key: 'test-key-2' });
    s.set(99);
    const stored = localStorage.getItem('test-key-2');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).value).toBe(99);
  });

  it('loads from localStorage on creation', () => {
    localStorage.setItem('test-key-3', JSON.stringify({ value: 77, ts: Date.now() }));
    const s = offlineSignal(0, { key: 'test-key-3' });
    expect(s()).toBe(77);
  });

  it('has syncNow method', () => {
    const s = offlineSignal(1, { key: 'test-key-4' });
    expect(typeof s.syncNow).toBe('function');
  });

  it('has pendingSync signal', () => {
    const s = offlineSignal(1, { key: 'test-key-5' });
    expect(typeof s.pendingSync).toBe('function');
  });

  it('syncs with remote when remote.set is provided', async () => {
    const remoteSets: number[] = [];
    const s = offlineSignal(10, {
      key: 'test-key-6',
      sync: 'immediate',
      remote: {
        get: async () => 10,
        set: async (v) => { remoteSets.push(v as number); },
      },
    });
    s.set(20);
    await s.syncNow();
    expect(remoteSets).toContain(20);
  });
});

describe('isOnline', () => {
  it('returns a boolean', () => {
    expect(typeof isOnline()).toBe('boolean');
  });
});

describe('onceOnline', () => {
  it('calls fn immediately if already online', () => {
    const fn = vi.fn();
    // In jsdom navigator.onLine is true by default
    onceOnline(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
