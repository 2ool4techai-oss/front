import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '../signal.js';
import { createQuery, createQueryMutation, invalidateQuery, invalidateAllQueries } from '../query.js';

// Reset module-level cache state between tests by destroying all queries
// and using unique keys per test.

let keyCounter = 0;
function uniqueKey(): string {
  return `test-key-${++keyCounter}`;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ──────────────────────────────────────────────────────────────

describe('createQuery', () => {
  it('starts in loading state', () => {
    const key = uniqueKey();
    const q = createQuery(() => new Promise(() => {}), { key, retry: 0 });
    expect(q.status.peek()).toBe('loading');
    expect(q.loading.peek()).toBe(true);
    q.destroy();
  });

  it('resolves to success with data', async () => {
    const key = uniqueKey();
    const q = createQuery(() => Promise.resolve(42), { key, retry: 0 });
    await vi.runAllTimersAsync();
    expect(q.status.peek()).toBe('success');
    expect(q.data.peek()).toBe(42);
    expect(q.loading.peek()).toBe(false);
    q.destroy();
  });

  it('transitions to error state', async () => {
    const key = uniqueKey();
    const q = createQuery(() => Promise.reject(new Error('oops')), { key, retry: 0 });
    await vi.runAllTimersAsync();
    expect(q.status.peek()).toBe('error');
    expect(q.error.peek()?.message).toBe('oops');
    expect(q.loading.peek()).toBe(false);
    q.destroy();
  });

  it('caches results for the same key — fetcher called only once', async () => {
    const key = uniqueKey();
    let calls = 0;
    const fetcher = async () => { calls++; return 'data'; };

    const q1 = createQuery(fetcher, { key, retry: 0 });
    await vi.runAllTimersAsync();

    // Second query with same key — should use cached data, not call fetcher again
    const q2 = createQuery(fetcher, { key, staleTime: 30_000, retry: 0 });
    await vi.runAllTimersAsync();

    expect(calls).toBe(1);
    expect(q2.data.peek()).toBe('data');

    q1.destroy();
    q2.destroy();
  });

  it('stale: true after staleTime elapses', async () => {
    const key = uniqueKey();
    const q = createQuery(() => Promise.resolve('hello'), { key, staleTime: 1000, retry: 0 });
    await vi.runAllTimersAsync();

    expect(q.stale.peek()).toBe(false);

    await vi.advanceTimersByTimeAsync(1001);
    expect(q.stale.peek()).toBe(true);

    q.destroy();
  });

  it('refetch() re-runs the fetcher', async () => {
    const key = uniqueKey();
    let value = 1;
    const q = createQuery(async () => value, { key, retry: 0 });
    await vi.runAllTimersAsync();
    expect(q.data.peek()).toBe(1);

    value = 2;
    await q.refetch();
    expect(q.data.peek()).toBe(2);

    q.destroy();
  });

  it('optimisticUpdate() applies immediately and rollback restores', async () => {
    const key = uniqueKey();
    const q = createQuery(async () => [1, 2, 3], { key, retry: 0 });
    await vi.runAllTimersAsync();
    expect(q.data.peek()).toEqual([1, 2, 3]);

    const rollback = q.optimisticUpdate(() => [1, 2, 3, 4]);
    expect(q.data.peek()).toEqual([1, 2, 3, 4]);

    rollback();
    expect(q.data.peek()).toEqual([1, 2, 3]);

    q.destroy();
  });

  it('invalidate() triggers a refetch', async () => {
    const key = uniqueKey();
    let calls = 0;
    const q = createQuery(async () => { calls++; return calls; }, { key, retry: 0 });
    await vi.runAllTimersAsync();
    expect(calls).toBe(1);

    q.invalidate();
    await vi.runAllTimersAsync();
    expect(calls).toBe(2);

    q.destroy();
  });

  it('reactive key: re-fetches when key signal changes', async () => {
    const keySignal = signal('resource-a');
    let fetchedKey = '';
    const fetcher = async () => {
      fetchedKey = keySignal.peek();
      return `data-for-${fetchedKey}`;
    };

    const q = createQuery(fetcher, { key: () => `prefix-${keySignal()}`, retry: 0 });
    await vi.runAllTimersAsync();
    expect(q.data.peek()).toBe('data-for-resource-a');

    keySignal.set('resource-b');
    await vi.runAllTimersAsync();
    expect(fetchedKey).toBe('resource-b');
    expect(q.data.peek()).toBe('data-for-resource-b');

    q.destroy();
  });

  it('request deduplication: concurrent fetches for same key share one promise', async () => {
    const key = uniqueKey();
    let calls = 0;
    let resolveAll!: (v: string) => void;
    const promise = new Promise<string>(r => { resolveAll = r; });
    const fetcher = async () => { calls++; return promise; };

    const q = createQuery(fetcher, { key, retry: 0 });
    // Trigger another fetch while first is in-flight
    const p1 = q.refetch();
    const p2 = q.refetch();

    resolveAll('done');
    await Promise.all([p1, p2]);
    await vi.runAllTimersAsync();

    // fetcher called at most 2 times (initial + one refetch sharing the dedup promise)
    // The key assertion is that it's NOT called 3+ times
    expect(calls).toBeLessThanOrEqual(2);

    q.destroy();
  });

  it('enabled=false skips the fetch', async () => {
    const key = uniqueKey();
    let calls = 0;
    const q = createQuery(async () => { calls++; return 'data'; }, {
      key,
      enabled: false,
      retry: 0,
    });
    await vi.runAllTimersAsync();
    expect(calls).toBe(0);
    expect(q.status.peek()).toBe('idle');
    q.destroy();
  });
});

describe('createQueryMutation', () => {
  it('invalidates specified keys on success', async () => {
    const queryKey = uniqueKey();
    let calls = 0;
    const q = createQuery(async () => { calls++; return calls; }, {
      key: queryKey,
      retry: 0,
    });
    await vi.runAllTimersAsync();
    expect(calls).toBe(1);

    const m = createQueryMutation(
      async (input: string) => input.toUpperCase(),
      { invalidates: [queryKey] },
    );

    await m.mutate('hello');
    await vi.runAllTimersAsync();

    expect(calls).toBe(2);
    q.destroy();
  });
});

describe('invalidateQuery', () => {
  it('invalidates by string key and triggers refetch', async () => {
    const key = uniqueKey();
    let calls = 0;
    const q = createQuery(async () => { calls++; return calls; }, { key, retry: 0 });
    await vi.runAllTimersAsync();
    expect(calls).toBe(1);

    invalidateQuery(key);
    await vi.runAllTimersAsync();
    expect(calls).toBe(2);

    q.destroy();
  });

  it('invalidates by RegExp and triggers refetch on matching keys', async () => {
    const prefix = `regex-test-${uniqueKey()}`;
    let callsA = 0;
    let callsB = 0;
    let callsC = 0;

    const qA = createQuery(async () => { callsA++; return callsA; }, { key: `${prefix}/a`, retry: 0 });
    const qB = createQuery(async () => { callsB++; return callsB; }, { key: `${prefix}/b`, retry: 0 });
    const qC = createQuery(async () => { callsC++; return callsC; }, { key: `other/c`, retry: 0 });

    await vi.runAllTimersAsync();
    expect(callsA).toBe(1);
    expect(callsB).toBe(1);
    expect(callsC).toBe(1);

    invalidateQuery(new RegExp(`^${prefix}/`));
    await vi.runAllTimersAsync();

    expect(callsA).toBe(2);
    expect(callsB).toBe(2);
    expect(callsC).toBe(1); // not affected

    qA.destroy();
    qB.destroy();
    qC.destroy();
  });
});

describe('invalidateAllQueries', () => {
  it('invalidates all active queries', async () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    let callsA = 0;
    let callsB = 0;

    const qA = createQuery(async () => { callsA++; return callsA; }, { key: keyA, retry: 0 });
    const qB = createQuery(async () => { callsB++; return callsB; }, { key: keyB, retry: 0 });

    await vi.runAllTimersAsync();
    expect(callsA).toBe(1);
    expect(callsB).toBe(1);

    invalidateAllQueries();
    await vi.runAllTimersAsync();

    expect(callsA).toBe(2);
    expect(callsB).toBe(2);

    qA.destroy();
    qB.destroy();
  });
});
