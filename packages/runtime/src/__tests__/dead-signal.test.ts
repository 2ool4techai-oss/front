import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDeadSignalDetector, watchedSignal } from '../dead-signal.js';

describe('createDeadSignalDetector — basic registration', () => {
  it('registers a signal and returns read/write hooks', () => {
    const detector = createDeadSignalDetector({ devOnly: false });
    const hooks = detector.register('mySignal');
    expect(typeof hooks.onRead).toBe('function');
    expect(typeof hooks.onWrite).toBe('function');
    detector.stop();
  });

  it('scan() returns empty when no signals registered', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    const dead = detector.scan();
    expect(dead).toHaveLength(0);
    detector.stop();
  });

  it('scan() returns dead signal after grace period with no access', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    detector.register('unusedSignal');
    const dead = detector.scan();
    expect(dead).toHaveLength(1);
    expect(dead[0]!.label).toBe('unusedSignal');
    detector.stop();
  });

  it('scan() does NOT flag signal within grace period', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 60_000 });
    detector.register('newSignal');
    const dead = detector.scan();
    expect(dead).toHaveLength(0);
    detector.stop();
  });

  it('scan() does NOT flag a signal that was read', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    const hooks = detector.register('readSignal');
    hooks.onRead();
    const dead = detector.scan();
    expect(dead).toHaveLength(0);
    detector.stop();
  });

  it('scan() does NOT flag a signal that was written', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    const hooks = detector.register('writtenSignal');
    hooks.onWrite();
    const dead = detector.scan();
    expect(dead).toHaveLength(0);
    detector.stop();
  });
});

describe('createDeadSignalDetector — reporting', () => {
  it('dead report includes label, createdAt, ageMs, lastAccessMs', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    detector.register('deadSig');
    const dead = detector.scan();
    expect(dead[0]).toMatchObject({
      label: 'deadSig',
      lastAccessMs: null,
    });
    expect(typeof dead[0]!.createdAt).toBe('number');
    expect(dead[0]!.ageMs).toBeGreaterThanOrEqual(0);
    detector.stop();
  });

  it('calls onDead when interval fires and dead signals found', () => {
    vi.useFakeTimers();
    const onDead = vi.fn();
    const detector = createDeadSignalDetector({
      devOnly: false,
      gracePeriodMs: 0,
      checkIntervalMs: 1000,
      onDead,
    });
    detector.register('zombieSig');

    vi.advanceTimersByTime(1001);
    expect(onDead).toHaveBeenCalledWith('zombieSig', expect.any(Number));
    detector.stop();
    vi.useRealTimers();
  });

  it('stop() prevents further interval callbacks', () => {
    vi.useFakeTimers();
    const onDead = vi.fn();
    const detector = createDeadSignalDetector({
      devOnly: false,
      gracePeriodMs: 0,
      checkIntervalMs: 1000,
      onDead,
    });
    detector.register('sig');
    detector.stop();

    vi.advanceTimersByTime(5000);
    expect(onDead).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('watchedSignal', () => {
  it('creates a signal with initial value', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    const s = watchedSignal(42, 'counter', detector);
    expect(s()).toBe(42);
    detector.stop();
  });

  it('marks signal as read after calling it', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    const s = watchedSignal(0, 'activeRead', detector);
    s(); // read
    const dead = detector.scan();
    expect(dead.find(d => d.label === 'activeRead')).toBeUndefined();
    detector.stop();
  });

  it('marks signal as written after calling set()', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    const s = watchedSignal(0, 'activeWrite', detector);
    s.set(1);
    const dead = detector.scan();
    expect(dead.find(d => d.label === 'activeWrite')).toBeUndefined();
    detector.stop();
  });

  it('shows signal as dead if never read or written', () => {
    const detector = createDeadSignalDetector({ devOnly: false, gracePeriodMs: 0 });
    watchedSignal(0, 'neverUsed', detector);
    const dead = detector.scan();
    expect(dead.find(d => d.label === 'neverUsed')).toBeDefined();
    detector.stop();
  });
});

describe('createDeadSignalDetector — devOnly mode', () => {
  it('returns no-op detector when devOnly and NODE_ENV is production', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const detector = createDeadSignalDetector({ devOnly: true, gracePeriodMs: 0 });
    const hooks = detector.register('sig');
    hooks.onRead();
    hooks.onWrite();
    expect(detector.scan()).toHaveLength(0);
    detector.stop();

    process.env['NODE_ENV'] = originalEnv;
  });
});
