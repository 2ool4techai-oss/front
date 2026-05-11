import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServerSignal } from '../server-signal.js';

describe('createServerSignal', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with idle status when no initialData', () => {
    const handle = createServerSignal(async () => 42);
    expect(handle.signal().status).toBe('idle');
    expect(handle.signal().data).toBeUndefined();
    handle.destroy();
  });

  it('starts with success status when initialData provided', () => {
    const handle = createServerSignal(async () => 42, { initialData: 99 });
    expect(handle.signal().status).toBe('success');
    expect(handle.signal().data).toBe(99);
    handle.destroy();
  });

  it('fetch() sets status to loading then success', async () => {
    const fetcher = vi.fn().mockResolvedValue('hello');
    const handle = createServerSignal(fetcher);
    const promise = handle.fetch();
    expect(handle.signal().status).toBe('loading');
    await promise;
    expect(handle.signal().status).toBe('success');
    expect(handle.signal().data).toBe('hello');
    handle.destroy();
  });

  it('fetch() sets status to error on failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('oops'));
    const handle = createServerSignal(fetcher);
    await handle.fetch();
    expect(handle.signal().status).toBe('error');
    expect(handle.signal().error).toBeInstanceOf(Error);
    handle.destroy();
  });

  it('setData() updates data and status to success', () => {
    const handle = createServerSignal(async () => 0);
    handle.setData(77);
    expect(handle.signal().data).toBe(77);
    expect(handle.signal().status).toBe('success');
    handle.destroy();
  });

  it('invalidate() sets status to idle', async () => {
    const handle = createServerSignal(async () => 'data', { initialData: 'data' });
    handle.invalidate();
    expect(handle.signal().status).toBe('idle');
    handle.destroy();
  });

  it('calls onSuccess callback after successful fetch', async () => {
    const onSuccess = vi.fn();
    const handle = createServerSignal(async () => 'result', { onSuccess });
    await handle.fetch();
    expect(onSuccess).toHaveBeenCalledWith('result');
    handle.destroy();
  });

  it('calls onError callback on failure', async () => {
    const onError = vi.fn();
    const err = new Error('fail');
    const handle = createServerSignal(async () => { throw err; }, { onError });
    await handle.fetch();
    expect(onError).toHaveBeenCalledWith(err);
    handle.destroy();
  });

  it('retries on error when retry > 0', async () => {
    let attempts = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('retry me');
      return 'ok';
    });
    const handle = createServerSignal(fetcher, { retry: 2 });
    await handle.fetch();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(handle.signal().status).toBe('success');
    handle.destroy();
  });

  it('destroy() prevents further state updates', async () => {
    let resolve!: (v: string) => void;
    const promise = new Promise<string>(r => { resolve = r; });
    const handle = createServerSignal(() => promise);
    void handle.fetch();
    handle.destroy();
    resolve('too late');
    await Promise.resolve(); // tick
    // Status should still be 'loading' (destroyed before resolve ran)
    // or idle — either way NOT 'success'
    expect(handle.signal().status).not.toBe('success');
  });
});
