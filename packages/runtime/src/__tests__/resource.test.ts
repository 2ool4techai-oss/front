import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createResource, createMutation, createCache } from '../resource.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// ── createResource ─────────────────────────────────────────────────────
describe('createResource', () => {
  it('starts in loading state', async () => {
    const r = createResource(() => new Promise(() => {})); // never resolves
    expect(r.loading()).toBe(true);
    expect(r.status()).toBe('loading');
    r.destroy();
  });

  it('resolves to success state', async () => {
    const r = createResource(() => Promise.resolve(42));
    await vi.runAllTimersAsync();
    expect(r.loading()).toBe(false);
    expect(r.data()).toBe(42);
    expect(r.status()).toBe('success');
    r.destroy();
  });

  it('transitions to error state on rejection', async () => {
    const r = createResource(() => Promise.reject(new Error('fail')), { retry: 0 });
    await vi.runAllTimersAsync();
    expect(r.loading()).toBe(false);
    expect(r.error()?.message).toBe('fail');
    expect(r.status()).toBe('error');
    r.destroy();
  });

  it('uses initialValue before first fetch', () => {
    const r = createResource(() => Promise.resolve('new'), { initialValue: 'old' });
    expect(r.data()).toBe('old');
    r.destroy();
  });

  it('retries on failure and eventually resolves', async () => {
    let attempts = 0;
    const r = createResource(async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient');
      return 'ok';
    }, { retry: 3, retryDelay: 10 });

    await vi.runAllTimersAsync();
    expect(r.data()).toBe('ok');
    expect(attempts).toBe(3);
    r.destroy();
  });

  it('calls onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const r = createResource(() => Promise.resolve('hello'), { onSuccess, retry: 0 });
    await vi.runAllTimersAsync();
    expect(onSuccess).toHaveBeenCalledWith('hello');
    r.destroy();
  });

  it('calls onError callback', async () => {
    const onError = vi.fn();
    const r = createResource(() => Promise.reject(new Error('oops')), { onError, retry: 0 });
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalled();
    r.destroy();
  });

  it('mutate() updates data optimistically', async () => {
    const r = createResource(() => Promise.resolve([1, 2, 3]));
    await vi.runAllTimersAsync();
    r.mutate([4, 5, 6]);
    expect(r.data()).toEqual([4, 5, 6]);
    r.destroy();
  });

  it('mutate() with updater function', async () => {
    const r = createResource(() => Promise.resolve(10));
    await vi.runAllTimersAsync();
    r.mutate(prev => (prev ?? 0) + 5);
    expect(r.data()).toBe(15);
    r.destroy();
  });

  it('cancels stale responses when refetched', async () => {
    let resolve1!: (v: number) => void;
    let call = 0;
    const r = createResource(() => {
      call++;
      if (call === 1) return new Promise(r => { resolve1 = r; });
      return Promise.resolve(99);
    }, { retry: 0 });

    // Trigger second fetch (stale time 0 means always refetch)
    void r.refetch();
    await vi.runAllTimersAsync();

    // First fetch resolves late — should be ignored
    resolve1(11);
    await vi.runAllTimersAsync();

    expect(r.data()).toBe(99); // second fetch wins
    r.destroy();
  });
});

// ── createMutation ─────────────────────────────────────────────────────
describe('createMutation', () => {
  it('starts in idle state', () => {
    const m = createMutation(async (x: number) => x);
    expect(m.loading()).toBe(false);
    expect(m.status()).toBe('idle');
  });

  it('transitions through loading→success', async () => {
    const m = createMutation((n: number) => Promise.resolve(n * 2));
    const p = m.mutate(5);
    expect(m.loading()).toBe(true);
    await p;
    expect(m.loading()).toBe(false);
    expect(m.data()).toBe(10);
    expect(m.status()).toBe('success');
  });

  it('transitions through loading→error', async () => {
    const m = createMutation(async () => { throw new Error('bad'); });
    await expect(m.mutate(undefined)).rejects.toThrow('bad');
    expect(m.status()).toBe('error');
    expect(m.error()?.message).toBe('bad');
  });

  it('calls onSuccess with result, input, and context', async () => {
    const onSuccess = vi.fn();
    const m = createMutation(
      (n: number) => Promise.resolve(n + 1),
      { onMutate: (n) => ({ original: n }), onSuccess },
    );
    await m.mutate(9);
    expect(onSuccess).toHaveBeenCalledWith(10, 9, { original: 9 });
  });

  it('calls onError with error, input, context', async () => {
    const onError = vi.fn();
    const m = createMutation(
      async () => { throw new Error('boom'); },
      { onMutate: () => 'ctx', onError },
    );
    await m.mutate(undefined).catch(() => {});
    expect(onError).toHaveBeenCalled();
    const [err, , ctx] = onError.mock.calls[0] as [Error, unknown, string];
    expect(err.message).toBe('boom');
    expect(ctx).toBe('ctx');
  });

  it('reset() returns to idle', async () => {
    const m = createMutation((n: number) => Promise.resolve(n));
    await m.mutate(1);
    m.reset();
    expect(m.status()).toBe('idle');
    expect(m.data()).toBeUndefined();
  });
});

// ── createCache ─────────────────────────────────────────────────────────
describe('createCache', () => {
  it('returns same resource for same key', async () => {
    const cache = createCache();
    const r1 = cache.get('a', () => Promise.resolve(1));
    const r2 = cache.get('a', () => Promise.resolve(2));
    expect(r1).toBe(r2);
  });

  it('increments size', () => {
    const cache = createCache();
    cache.get('x', () => Promise.resolve(1));
    cache.get('y', () => Promise.resolve(2));
    expect(cache.size).toBe(2);
  });

  it('invalidate() triggers refetch', async () => {
    let calls = 0;
    // gcTime: 0 disables GC so vi.advanceTimersByTimeAsync won't destroy the entry
    const cache = createCache({ defaultGcTime: 0 });
    cache.get('z', async () => { calls++; return calls; });
    await vi.advanceTimersByTimeAsync(50);
    cache.invalidate('z');
    await vi.advanceTimersByTimeAsync(50);
    expect(calls).toBe(2);
  });

  it('invalidateAll() refetches all keys', async () => {
    let callsA = 0; let callsB = 0;
    const cache = createCache({ defaultGcTime: 0 });
    cache.get('a', async () => { callsA++; return callsA; });
    cache.get('b', async () => { callsB++; return callsB; });
    await vi.advanceTimersByTimeAsync(50);
    cache.invalidateAll();
    await vi.advanceTimersByTimeAsync(50);
    expect(callsA).toBe(2);
    expect(callsB).toBe(2);
  });

  it('invalidate with RegExp matches multiple keys', async () => {
    let calls = 0;
    const cache = createCache({ defaultGcTime: 0 });
    cache.get('users/1', async () => { calls++; return calls; });
    cache.get('users/2', async () => { calls++; return calls; });
    cache.get('posts/1', async () => { calls++; return calls; });
    await vi.advanceTimersByTimeAsync(50);
    cache.invalidate(/^users\//);
    await vi.advanceTimersByTimeAsync(50);
    // users/1 and users/2 refetched (2 extra calls), posts/1 not
    expect(calls).toBe(5);
  });
});
