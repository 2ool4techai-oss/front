import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { circuit, withFallback, retry, timeout } from '../resilience.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Helper ────────────────────────────────────────────────────────────────

function failing(msg = 'fail'): () => Promise<never> {
  return () => Promise.reject(new Error(msg));
}

function succeeding<T>(val: T): () => Promise<T> {
  return () => Promise.resolve(val);
}

// ── circuit() ─────────────────────────────────────────────────────────────

describe('circuit()', () => {
  it('starts in healthy state', () => {
    const cb = circuit({ fallback: 'fallback', failureThreshold: 2 });
    expect(cb.state()).toBe('healthy');
    expect(cb.failures()).toBe(0);
    expect(cb.isOpen()).toBe(false);
  });

  it('call() succeeds and returns value', async () => {
    const cb = circuit({ fallback: 'fallback', failureThreshold: 2 });
    const result = await cb.call(succeeding('42'));
    expect(result).toBe('42');
    expect(cb.state()).toBe('healthy');
  });

  it('transitions to open after failureThreshold failures', async () => {
    const cb = circuit({ fallback: 'fallback', failureThreshold: 2 });
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('healthy');
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');
    expect(cb.isOpen()).toBe(true);
  });

  it('returns fallback when circuit is open', async () => {
    const cb = circuit({ fallback: 'fallback-value', failureThreshold: 2 });
    await expect(cb.call(failing())).rejects.toThrow();
    await expect(cb.call(failing())).rejects.toThrow();
    // Circuit is now open
    expect(cb.state()).toBe('open');
    const result = await cb.call(failing()); // should not throw
    expect(result).toBe('fallback-value');
  });

  it('transitions to half-open after halfOpenAfter timeout', async () => {
    const cb = circuit({ fallback: 'fallback', failureThreshold: 2, halfOpenAfter: 1000 });
    await expect(cb.call(failing())).rejects.toThrow();
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');

    vi.advanceTimersByTime(1000);
    await Promise.resolve(); // flush microtasks
    expect(cb.state()).toBe('half-open');
  });

  it('recovers to healthy after successful probes in half-open', async () => {
    const cb = circuit({ fallback: 'fallback', failureThreshold: 2, halfOpenAfter: 1000, halfOpenProbes: 1 });
    await expect(cb.call(failing())).rejects.toThrow();
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');

    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(cb.state()).toBe('half-open');

    const result = await cb.call(succeeding('ok'));
    expect(result).toBe('ok');
    expect(cb.state()).toBe('healthy');
  });

  it('re-opens on failure during half-open', async () => {
    const cb = circuit({ fallback: 'fallback', failureThreshold: 2, halfOpenAfter: 1000 });
    await expect(cb.call(failing())).rejects.toThrow();
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');

    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(cb.state()).toBe('half-open');

    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');
  });

  it('reset() returns circuit to healthy', async () => {
    const cb = circuit({ fallback: 'fallback', failureThreshold: 2 });
    await expect(cb.call(failing())).rejects.toThrow();
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');

    cb.reset();
    expect(cb.state()).toBe('healthy');
    expect(cb.failures()).toBe(0);
    expect(cb.isOpen()).toBe(false);
  });

  it('trip() manually opens circuit', async () => {
    const cb = circuit({ fallback: 'fallback', failureThreshold: 5 });
    expect(cb.state()).toBe('healthy');
    cb.trip();
    expect(cb.state()).toBe('open');
    expect(cb.isOpen()).toBe(true);

    const result = await cb.call(succeeding('should-not-run'));
    expect(result).toBe('fallback');
  });

  it('retry policy retries on failure', async () => {
    let calls = 0;
    const cb = circuit({
      fallback: 'fallback',
      failureThreshold: 10,
      retry: { maxAttempts: 3, backoff: 'fixed', delayMs: 50 },
    });

    const fn = (): Promise<string> => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('not yet'));
      return Promise.resolve('success');
    };

    const resultP = cb.call(fn);
    // advance timers for retry delays
    await vi.runAllTimersAsync();
    const result = await resultP;
    expect(result).toBe('success');
    expect(calls).toBe(3);
  });

  it('onStateChange callback fires on transitions', async () => {
    const changes: Array<[ResilienceState: string, prev: string]> = [];
    const cb = circuit({
      fallback: 'fallback',
      failureThreshold: 2,
      onStateChange: (next, prev) => changes.push([next, prev]),
    });

    await expect(cb.call(failing())).rejects.toThrow();
    await expect(cb.call(failing())).rejects.toThrow();

    expect(changes).toContainEqual(['open', 'healthy']);
  });

  it('bulkhead rejects when concurrency exceeded', async () => {
    const cb = circuit({
      fallback: 'fallback',
      failureThreshold: 10,
      bulkhead: { maxConcurrent: 1, maxQueue: 0 },
    });

    // Start one long-running call
    let resolve1!: () => void;
    const p1 = cb.call(() => new Promise<string>(r => { resolve1 = () => r('done'); }));

    // Second call should be rejected because maxConcurrent=1 and maxQueue=0
    await expect(cb.call(succeeding('second'))).rejects.toThrow(/Bulkhead/);

    resolve1();
    const r1 = await p1;
    expect(r1).toBe('done');
  });
});

// ── timeout() ─────────────────────────────────────────────────────────────

describe('timeout()', () => {
  it('rejects after ms', async () => {
    const p = timeout(() => new Promise<string>(() => { /* never resolves */ }), 100);
    vi.advanceTimersByTime(100);
    await expect(p).rejects.toThrow(/Timed out/);
  });

  it('resolves when fn completes in time', async () => {
    const result = await timeout(succeeding('fast'), 1000);
    expect(result).toBe('fast');
  });
});

// ── withFallback() ────────────────────────────────────────────────────────

describe('withFallback()', () => {
  it('returns fallback on error', async () => {
    const result = await withFallback(failing(), 'my-fallback');
    expect(result).toBe('my-fallback');
  });

  it('returns actual result on success', async () => {
    const result = await withFallback(succeeding('real'), 'fallback');
    expect(result).toBe('real');
  });

  it('accepts fallback function', async () => {
    const result = await withFallback(failing(), () => 'computed-fallback');
    expect(result).toBe('computed-fallback');
  });
});

// ── retry() ───────────────────────────────────────────────────────────────

describe('retry()', () => {
  it('retries on failure and succeeds', async () => {
    let calls = 0;
    const fn = (): Promise<string> => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('not yet'));
      return Promise.resolve('done');
    };

    const p = retry(fn, { maxAttempts: 3, backoff: 'fixed', delayMs: 50 });
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result).toBe('done');
    expect(calls).toBe(3);
  });

  it('throws after maxAttempts exhausted', async () => {
    let calls = 0;
    const fn = (): Promise<never> => {
      calls++;
      return Promise.reject(new Error(`fail #${calls}`));
    };

    const p = retry(fn, { maxAttempts: 2, backoff: 'fixed', delayMs: 10 });
    // Attach catch before advancing timers to avoid unhandled rejection
    const caught = p.catch((e: Error) => e.message);
    await vi.runAllTimersAsync();
    const msg = await caught;
    expect(msg).toBe('fail #2');
    expect(calls).toBe(2);
  });

  it('uses exponential backoff', async () => {
    let calls = 0;
    const fn = (): Promise<string> => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('x'));
      return Promise.resolve('ok');
    };

    const p = retry(fn, { maxAttempts: 3, backoff: 'exponential', delayMs: 100 });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
  });
});

// ── halfOpenAfter string parsing ──────────────────────────────────────────

describe('halfOpenAfter string parsing', () => {
  it('parses "30s" as 30 000 ms', async () => {
    const cb = circuit({ fallback: null, failureThreshold: 1, halfOpenAfter: '30s' });
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');

    vi.advanceTimersByTime(29_999);
    await Promise.resolve();
    expect(cb.state()).toBe('open');

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(cb.state()).toBe('half-open');
  });

  it('parses "1m" as 60 000 ms', async () => {
    const cb = circuit({ fallback: null, failureThreshold: 1, halfOpenAfter: '1m' });
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');

    vi.advanceTimersByTime(59_999);
    await Promise.resolve();
    expect(cb.state()).toBe('open');

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(cb.state()).toBe('half-open');
  });

  it('parses "2.5m" as 150 000 ms', async () => {
    const cb = circuit({ fallback: null, failureThreshold: 1, halfOpenAfter: '2.5m' });
    await expect(cb.call(failing())).rejects.toThrow();
    expect(cb.state()).toBe('open');

    vi.advanceTimersByTime(150_000);
    await Promise.resolve();
    expect(cb.state()).toBe('half-open');
  });
});
