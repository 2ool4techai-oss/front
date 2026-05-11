import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTRPCQuery, createTRPCMutation } from '../trpc.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createTRPCQuery', () => {
  it('fetches on create when enabled', async () => {
    const proc = vi.fn().mockResolvedValue(42);
    const q = createTRPCQuery(proc);
    await vi.runAllTimersAsync();
    expect(proc).toHaveBeenCalledTimes(1);
    q.destroy();
  });

  it('data signal has result after fetch', async () => {
    const q = createTRPCQuery(vi.fn().mockResolvedValue('hello'));
    await vi.runAllTimersAsync();
    expect(q.data.peek()).toBe('hello');
    q.destroy();
  });

  it('status goes loading then success', async () => {
    const q = createTRPCQuery(vi.fn().mockResolvedValue(1), { retry: 0 });
    expect(q.status.peek()).toBe('loading');
    await vi.runAllTimersAsync();
    expect(q.status.peek()).toBe('success');
    q.destroy();
  });

  it('status goes loading then error on failure', async () => {
    const proc = vi.fn().mockRejectedValue(new Error('fail'));
    const q = createTRPCQuery(proc, { retry: 0 });
    expect(q.status.peek()).toBe('loading');
    await vi.runAllTimersAsync();
    expect(q.status.peek()).toBe('error');
    expect(q.error.peek()).toBeInstanceOf(Error);
    q.destroy();
  });

  it('retries N times on error', async () => {
    const proc = vi.fn().mockRejectedValue(new Error('fail'));
    const q = createTRPCQuery(proc, { retry: 2 });
    await vi.runAllTimersAsync();
    // initial attempt + 2 retries = 3 calls
    expect(proc).toHaveBeenCalledTimes(3);
    q.destroy();
  });

  it('invalidate() triggers refetch', async () => {
    const proc = vi.fn().mockResolvedValue(1);
    const q = createTRPCQuery(proc, { retry: 0 });
    await vi.runAllTimersAsync();
    expect(proc).toHaveBeenCalledTimes(1);
    q.invalidate();
    await vi.runAllTimersAsync();
    expect(proc).toHaveBeenCalledTimes(2);
    q.destroy();
  });

  it('setData() updates signal directly', async () => {
    const q = createTRPCQuery<undefined, number>(vi.fn().mockResolvedValue(0), { retry: 0 });
    await vi.runAllTimersAsync();
    q.setData(99);
    expect(q.data.peek()).toBe(99);
    expect(q.status.peek()).toBe('success');
    q.destroy();
  });

  it('onSuccess callback fires', async () => {
    const onSuccess = vi.fn();
    const q = createTRPCQuery(vi.fn().mockResolvedValue('ok'), { retry: 0, onSuccess });
    await vi.runAllTimersAsync();
    expect(onSuccess).toHaveBeenCalledWith('ok');
    q.destroy();
  });

  it('onError callback fires', async () => {
    const onError = vi.fn();
    const q = createTRPCQuery(vi.fn().mockRejectedValue('boom'), { retry: 0, onError });
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledWith('boom');
    q.destroy();
  });
});

describe('createTRPCMutation', () => {
  it('mutate() calls procedure', async () => {
    const proc = vi.fn().mockResolvedValue('result');
    const m = createTRPCMutation(proc);
    await m.mutate('input' as unknown as never);
    expect(proc).toHaveBeenCalledWith('input');
  });

  it('loading is true during call, false after', async () => {
    let resolve!: (v: string) => void;
    const proc = vi.fn().mockReturnValue(new Promise<string>(r => { resolve = r; }));
    const m = createTRPCMutation(proc);
    const p = m.mutate('x' as unknown as never);
    expect(m.loading.peek()).toBe(true);
    resolve('done');
    await p;
    expect(m.loading.peek()).toBe(false);
  });

  it('mutation error is captured', async () => {
    const proc = vi.fn().mockRejectedValue(new Error('bad'));
    const m = createTRPCMutation(proc);
    await expect(m.mutate('x' as unknown as never)).rejects.toThrow('bad');
    expect(m.error.peek()).toBeInstanceOf(Error);
  });

  it('reset() clears data and error', async () => {
    const proc = vi.fn().mockRejectedValue(new Error('bad'));
    const m = createTRPCMutation(proc);
    await expect(m.mutate('x' as unknown as never)).rejects.toThrow();
    m.reset();
    expect(m.data.peek()).toBeUndefined();
    expect(m.error.peek()).toBeUndefined();
  });
});
