import { describe, it, expect, vi } from 'vitest';
import { signal } from '../signal.js';
import { createOptimistic } from '../optimistic.js';

describe('createOptimistic – basic mutations', () => {
  it('immediately applies optimistic value', async () => {
    const src = signal('initial');
    const opt = createOptimistic(src);

    let serverResolve!: (v: string) => void;
    const serverPromise = new Promise<string>(res => { serverResolve = res; });

    const mutatePromise = opt.mutate('optimistic', () => serverPromise);
    expect(src()).toBe('optimistic');

    serverResolve('confirmed');
    await mutatePromise;
    expect(src()).toBe('confirmed');
  });

  it('sets signal to server result on success', async () => {
    const src = signal(0);
    const opt = createOptimistic(src);
    await opt.mutate(99, async () => 42);
    expect(src()).toBe(42);
  });

  it('pending is true during mutation, false after', async () => {
    const src = signal('a');
    const opt = createOptimistic(src);

    let serverResolve!: (v: string) => void;
    const serverPromise = new Promise<string>(res => { serverResolve = res; });

    const mutatePromise = opt.mutate('b', () => serverPromise);
    expect(opt.pending()).toBe(true);

    serverResolve('c');
    await mutatePromise;
    expect(opt.pending()).toBe(false);
  });

  it('pending starts as false before any mutation', () => {
    const src = signal(1);
    const opt = createOptimistic(src);
    expect(opt.pending()).toBe(false);
  });
});

describe('createOptimistic – rollback on error', () => {
  it('rolls back on server error', async () => {
    const src = signal('original');
    const opt = createOptimistic(src);

    try {
      await opt.mutate('optimistic', async () => { throw new Error('server error'); });
    } catch {
      // may or may not throw
    }

    expect(src()).toBe('original');
  });

  it('pending is false after error', async () => {
    const src = signal('x');
    const opt = createOptimistic(src);

    try {
      await opt.mutate('y', async () => { throw new Error('fail'); });
    } catch {
      // expected
    }

    expect(opt.pending()).toBe(false);
  });

  it('onError callback called with error', async () => {
    const onError = vi.fn();
    const src = signal('start');
    const opt = createOptimistic(src, { onError });

    try {
      await opt.mutate('new', async () => { throw new Error('boom'); });
    } catch {
      // may re-throw
    }

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0]![0] as Error).message).toBe('boom');
  });

  it('onError receives rollback function', async () => {
    const src = signal('before');
    let rollbackFn: (() => void) | undefined;
    const opt = createOptimistic(src, {
      onError: (_err, rb) => { rollbackFn = rb; },
    });

    try {
      // Snapshot is captured at start of mutate — value is 'before'
      await opt.mutate('optimistic', async () => { throw new Error('err'); });
    } catch {
      // expected
    }

    // onError was called with a rollback function
    expect(rollbackFn).toBeDefined();
    // rollback function restores the snapshot ('before')
    rollbackFn!();
    expect(src()).toBe('before');
  });
});

describe('createOptimistic – manual rollback', () => {
  it('manual rollback() restores snapshot', async () => {
    const src = signal('snap');
    const opt = createOptimistic(src);

    let serverResolve!: (v: string) => void;
    const serverPromise = new Promise<string>(res => { serverResolve = res; });

    opt.mutate('optimistic', () => serverPromise).catch(() => {});
    expect(src()).toBe('optimistic');

    opt.rollback();
    expect(src()).toBe('snap');
    serverResolve('done');
  });
});
