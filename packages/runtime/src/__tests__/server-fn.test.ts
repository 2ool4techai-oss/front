import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServerFn } from '../server-fn.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createServerFn – basic execution', () => {
  it('returns result from async function', async () => {
    const fn = createServerFn(async (x: number) => x * 2);
    const result = await fn(21);
    expect(result).toBe(42);
  });

  it('sets loading true during fetch, false after', async () => {
    let resolve: (v: string) => void;
    const promise = new Promise<string>(res => { resolve = res; });
    const fn = createServerFn(async () => promise);

    const loadingValues: boolean[] = [];
    fn.loading.subscribe(v => loadingValues.push(v));

    const callPromise = fn();
    // loading should be true now
    expect(fn.loading()).toBe(true);

    resolve!('done');
    await callPromise;

    expect(fn.loading()).toBe(false);
  });

  it('loading is false before any call', () => {
    const fn = createServerFn(async () => 'hello');
    expect(fn.loading()).toBe(false);
  });

  it('passes multiple arguments correctly', async () => {
    const fn = createServerFn(async (a: number, b: number) => a + b);
    const result = await fn(10, 32);
    expect(result).toBe(42);
  });
});

describe('createServerFn – caching', () => {
  it('caches result within TTL', async () => {
    let callCount = 0;
    const fn = createServerFn(async (x: number) => { callCount++; return x; }, { cache: 60 });

    await fn(1);
    await fn(1);
    expect(callCount).toBe(1);
  });

  it('does not cache with different args', async () => {
    let callCount = 0;
    const fn = createServerFn(async (x: number) => { callCount++; return x; }, { cache: 60 });

    await fn(1);
    await fn(2);
    expect(callCount).toBe(2);
  });

  it('invalidate() clears cache and forces re-fetch', async () => {
    let callCount = 0;
    const fn = createServerFn(async () => { callCount++; return callCount; }, { cache: 60 });

    await fn();
    fn.invalidate();
    await fn();
    expect(callCount).toBe(2);
  });

  it('calls function again after TTL expires', async () => {
    let callCount = 0;
    const fn = createServerFn(async () => { callCount++; return callCount; }, { cache: 1 });

    await fn();
    // Advance time past TTL (1 second = 1000ms)
    vi.advanceTimersByTime(2000);
    await fn();
    expect(callCount).toBe(2);
  });
});

describe('createServerFn – error handling', () => {
  it('sets error signal on failure', async () => {
    const fn = createServerFn(async () => { throw new Error('oops'); });
    try {
      await fn();
    } catch {
      // expected
    }
    expect(fn.error()).toBeInstanceOf(Error);
    expect((fn.error() as Error).message).toBe('oops');
  });

  it('loading is false after error', async () => {
    const fn = createServerFn(async () => { throw new Error('fail'); });
    try {
      await fn();
    } catch {
      // expected
    }
    expect(fn.loading()).toBe(false);
  });
});
