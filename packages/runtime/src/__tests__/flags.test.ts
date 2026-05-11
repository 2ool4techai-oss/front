import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFlag, createFlagStore } from '../flags.js';

// Provide a simple localStorage mock for tests
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem:    (k: string) => localStorageStore[k] ?? null,
  setItem:    (k: string, v: string) => { localStorageStore[k] = v; },
  removeItem: (k: string) => { delete localStorageStore[k]; },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  // Clear mock storage before each test
  for (const k of Object.keys(localStorageStore)) {
    delete localStorageStore[k];
  }
});

describe('createFlag', () => {
  it('returns handle with value signal', () => {
    const flag = createFlag('test-bool', { defaultValue: false });
    expect(typeof flag.value).toBe('function');
    expect(flag.value()).toBe(false);
  });

  it('isEnabled() true when rollout=1', () => {
    const flag = createFlag('enabled', { defaultValue: true, rollout: 1 });
    expect(flag.isEnabled()).toBe(true);
  });

  it('isEnabled() false when rollout=0', () => {
    const flag = createFlag('disabled', { defaultValue: false, rollout: 0 });
    expect(flag.isEnabled()).toBe(false);
  });

  it('override() changes value', () => {
    const flag = createFlag('ov-flag', { defaultValue: false });
    expect(flag.value()).toBe(false);
    flag.override(true);
    expect(flag.value()).toBe(true);
  });

  it('reset() removes override', () => {
    const flag = createFlag('reset-flag', { defaultValue: false });
    flag.override(true);
    expect(flag.value()).toBe(true);
    flag.reset();
    expect(flag.value()).toBe(false);
  });

  it('deterministic: same userId+key always same result', () => {
    const cfg = { defaultValue: 'control', variants: ['control', 'treatment'] as const, rollout: 1, userId: 'user-42' };
    const flag1 = createFlag('ab-test', cfg);
    const flag2 = createFlag('ab-test', cfg);
    expect(flag1.value()).toBe(flag2.value());
  });

  it('variant for boolean flag is enabled/disabled', () => {
    const flagOn  = createFlag('var-on',  { defaultValue: true });
    const flagOff = createFlag('var-off', { defaultValue: false });
    expect(flagOn.variant()).toBe('enabled');
    expect(flagOff.variant()).toBe('disabled');
  });

  it('track() dispatches CustomEvent', () => {
    const flag = createFlag('track-flag', { defaultValue: true });
    const spy  = vi.fn();
    window.addEventListener('dr:flag:track', spy);
    flag.track('click', { page: 'home' });
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('dr:flag:track', spy);
  });
});

describe('createFlagStore', () => {
  it('get() returns FlagHandle', () => {
    const store = createFlagStore({
      myFlag: { defaultValue: false },
    });
    const handle = store.get<boolean>('myFlag');
    expect(typeof handle.value).toBe('function');
    expect(handle.value()).toBe(false);
  });

  it('getAll() returns all values', () => {
    const store = createFlagStore({
      flagA: { defaultValue: true },
      flagB: { defaultValue: 42 },
    });
    const all = store.getAll();
    expect(all['flagA']).toBe(true);
    expect(all['flagB']).toBe(42);
  });
});
