import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimitSignal, RateLimitError } from '../rate-limit-signal.js';

beforeEach(() => {
  vi.useRealTimers();
});

describe('rateLimitSignal', () => {
  it('holds initial value', () => {
    const sig = rateLimitSignal(0, { maxWrites: 5, windowMs: 1000 });
    expect(sig()).toBe(0);
    expect(sig.peek()).toBe(0);
  });

  it('allows writes up to the limit', () => {
    const sig = rateLimitSignal(0, { maxWrites: 3, windowMs: 10000 });
    sig.set(1);
    sig.set(2);
    sig.set(3);
    expect(sig()).toBe(3);
  });

  it('drops writes when mode is drop (default) and limit is exceeded', () => {
    const sig = rateLimitSignal(0, { maxWrites: 2, windowMs: 10000, mode: 'drop' });
    sig.set(1);
    sig.set(2);
    sig.set(999); // should be dropped
    expect(sig()).toBe(2);
  });

  it('throws RateLimitError when mode is throw and limit is exceeded', () => {
    const sig = rateLimitSignal(0, { maxWrites: 2, windowMs: 10000, mode: 'throw' });
    sig.set(1);
    sig.set(2);
    expect(() => sig.set(3)).toThrow(RateLimitError);
  });

  it('RateLimitError is an instance of Error', () => {
    const err = new RateLimitError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.name).toBe('RateLimitError');
  });

  it('calls onViolation callback when limit exceeded', () => {
    const onViolation = vi.fn();
    const sig = rateLimitSignal(0, {
      maxWrites: 1,
      windowMs: 10000,
      mode: 'drop',
      onViolation,
    });
    sig.set(1); // within limit
    sig.set(2); // violation
    expect(onViolation).toHaveBeenCalledOnce();
    expect(onViolation).toHaveBeenCalledWith(expect.any(Number), 10000);
  });

  it('writeCount() returns current count in window', () => {
    const sig = rateLimitSignal(0, { maxWrites: 10, windowMs: 10000 });
    expect(sig.writeCount()).toBe(0);
    sig.set(1);
    sig.set(2);
    expect(sig.writeCount()).toBe(2);
  });

  it('isLimited() returns false below limit and true at or above limit', () => {
    const sig = rateLimitSignal(0, { maxWrites: 2, windowMs: 10000 });
    expect(sig.isLimited()).toBe(false);
    sig.set(1);
    expect(sig.isLimited()).toBe(false);
    sig.set(2);
    expect(sig.isLimited()).toBe(true);
  });

  it('reset() clears the window counter', () => {
    const sig = rateLimitSignal(0, { maxWrites: 2, windowMs: 10000 });
    sig.set(1);
    sig.set(2);
    expect(sig.isLimited()).toBe(true);
    sig.reset();
    expect(sig.isLimited()).toBe(false);
    expect(sig.writeCount()).toBe(0);
    // Can write again after reset
    sig.set(5);
    expect(sig()).toBe(5);
  });

  it('force() bypasses the rate limit', () => {
    const sig = rateLimitSignal(0, { maxWrites: 1, windowMs: 10000, mode: 'throw' });
    sig.set(1); // uses the quota
    // force() should not throw even though quota is exhausted
    expect(() => sig.force(999)).not.toThrow();
    expect(sig.peek()).toBe(999);
  });

  it('queue mode schedules writes for after the window', async () => {
    vi.useFakeTimers();
    const sig = rateLimitSignal(0, { maxWrites: 1, windowMs: 100, mode: 'queue' });
    sig.set(1); // within limit
    sig.set(2); // queued
    // Value should still be 1 (2 is queued)
    expect(sig.peek()).toBe(1);
    // After window expires, the queued write fires
    await vi.advanceTimersByTimeAsync(110);
    expect(sig.peek()).toBe(2);
    vi.useRealTimers();
  });

  it('window resets after time passes', async () => {
    vi.useFakeTimers();
    const sig = rateLimitSignal(0, { maxWrites: 2, windowMs: 100, mode: 'drop' });
    sig.set(1);
    sig.set(2);
    expect(sig.isLimited()).toBe(true);
    // Advance past window
    await vi.advanceTimersByTimeAsync(110);
    expect(sig.isLimited()).toBe(false);
    sig.set(3);
    expect(sig()).toBe(3);
    vi.useRealTimers();
  });
});
