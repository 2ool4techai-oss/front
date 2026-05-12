import { describe, it, expect, vi } from 'vitest';
import { lazySignal, splitOn, prefetchWhen } from '../lazysplit.js';
import { signal } from '../signal.js';

describe('lazySignal', () => {
  it('starts with idle status and undefined value', () => {
    const ls = lazySignal(() => Promise.resolve({ default: () => document.createElement('div') }));
    expect(ls.status()).toBe('idle');
    expect(ls()).toBeUndefined();
  });

  it('transitions to loaded after load()', async () => {
    const mockEl = document.createElement('span');
    const ls = lazySignal<HTMLElement>(() => Promise.resolve({ default: () => mockEl }));
    await ls.load();
    expect(ls.status()).toBe('loaded');
    expect(ls()).toBe(mockEl);
  });

  it('transitions to error on load failure', async () => {
    const ls = lazySignal(() => Promise.reject(new Error('failed')));
    try { await ls.load(); } catch {}
    expect(ls.status()).toBe('error');
  });

  it('only loads once (idempotent)', async () => {
    const loader = vi.fn(() => Promise.resolve({ default: () => document.createElement('div') }));
    const ls = lazySignal(loader);
    await ls.load();
    await ls.load(); // second call should be noop
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('peek returns current value without subscribing', async () => {
    const el = document.createElement('div');
    const ls = lazySignal<HTMLElement>(() => Promise.resolve({ default: () => el }));
    await ls.load();
    expect(ls.peek()).toBe(el);
  });

  it('subscribe fires when value changes', async () => {
    const el = document.createElement('div');
    const ls = lazySignal<HTMLElement>(() => Promise.resolve({ default: () => el }));
    const spy = vi.fn();
    ls.subscribe(spy);
    await ls.load();
    expect(spy).toHaveBeenCalledWith(el);
  });
});

describe('splitOn', () => {
  it('loads module when condition becomes true', async () => {
    const cond = signal(false);
    const loader = vi.fn(() => Promise.resolve({ default: () => document.createElement('div') }));
    splitOn(cond, loader);
    expect(loader).not.toHaveBeenCalled();
    cond.set(true);
    await Promise.resolve(); // allow microtask to run
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('prefetchWhen', () => {
  it('calls loader when condition returns true', async () => {
    const loader = vi.fn(() => Promise.resolve({ default: null }));
    prefetchWhen(() => true, loader);
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
