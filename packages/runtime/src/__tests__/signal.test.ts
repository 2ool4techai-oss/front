import { describe, it, expect, vi } from 'vitest';
import { signal, computed, effect, batch, untrack, createStore } from '../signal.js';

// ── signal ─────────────────────────────────────────────────────────────
describe('signal', () => {
  it('holds initial value', () => {
    const s = signal(42);
    expect(s()).toBe(42);
    expect(s.peek()).toBe(42);
  });

  it('updates value with set()', () => {
    const s = signal(0);
    s.set(10);
    expect(s()).toBe(10);
  });

  it('does not notify on same-value set', () => {
    const s = signal(1);
    const spy = vi.fn();
    s.subscribe(spy);
    spy.mockClear();
    s.set(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('notifies subscribers on change', () => {
    const s = signal('a');
    const spy = vi.fn();
    s.subscribe(spy);
    spy.mockClear();
    s.set('b');
    expect(spy).toHaveBeenCalledWith('b');
  });

  it('subscribe fires immediately with current value', () => {
    const s = signal(7);
    const spy = vi.fn();
    s.subscribe(spy);
    expect(spy).toHaveBeenCalledWith(7);
  });

  it('unsubscribe stops notifications', () => {
    const s = signal(0);
    const spy = vi.fn();
    const unsub = s.subscribe(spy);
    spy.mockClear();
    unsub();
    s.set(99);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── computed ───────────────────────────────────────────────────────────
describe('computed', () => {
  it('derives value from signals', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a() + b());
    expect(sum()).toBe(5);
  });

  it('updates when dependency changes', () => {
    const x = signal(10);
    const double = computed(() => x() * 2);
    expect(double()).toBe(20);
    x.set(5);
    expect(double()).toBe(10);
  });

  it('is lazy — fn not called until read', () => {
    const fn = vi.fn(() => 0);
    const c = computed(fn);
    expect(fn).not.toHaveBeenCalled();
    c();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('caches value when deps unchanged', () => {
    const s = signal(1);
    const fn = vi.fn(() => s() * 2);
    const c = computed(fn);
    c(); c(); c();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws on set()', () => {
    const c = computed(() => 1);
    expect(() => c.set(2)).toThrow();
  });

  it('chains correctly', () => {
    const a = signal(1);
    const b = computed(() => a() + 1);
    const c = computed(() => b() + 1);
    expect(c()).toBe(3);
    a.set(10);
    expect(c()).toBe(12);
  });
});

// ── effect ─────────────────────────────────────────────────────────────
describe('effect', () => {
  it('runs immediately', () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-runs when tracked signal changes', () => {
    const s = signal(0);
    const fn = vi.fn(() => { s(); });
    effect(fn);
    fn.mockClear();
    s.set(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not re-run when untracked signal changes', () => {
    const a = signal(0);
    const b = signal(0);
    const fn = vi.fn(() => { a(); }); // only tracks a
    effect(fn);
    fn.mockClear();
    b.set(1); // b is not tracked
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs cleanup on re-run', () => {
    const cleanup = vi.fn();
    const s = signal(0);
    effect(() => { s(); return () => cleanup(); });
    expect(cleanup).not.toHaveBeenCalled();
    s.set(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('runs cleanup on dispose', () => {
    const cleanup = vi.fn();
    const dispose = effect(() => () => cleanup());
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('stops running after dispose', () => {
    const s = signal(0);
    const fn = vi.fn(() => { s(); });
    const dispose = effect(fn);
    fn.mockClear();
    dispose();
    s.set(5);
    expect(fn).not.toHaveBeenCalled();
  });
});

// ── batch ──────────────────────────────────────────────────────────────
describe('batch', () => {
  it('defers effects until batch ends', () => {
    const a = signal(0);
    const b = signal(0);
    const fn = vi.fn(() => { a(); b(); });
    effect(fn);
    fn.mockClear();

    batch(() => { a.set(1); b.set(2); });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('nested batches flush only at outermost end', () => {
    const s = signal(0);
    const fn = vi.fn(() => { s(); });
    effect(fn);
    fn.mockClear();

    batch(() => {
      batch(() => { s.set(1); s.set(2); });
      // still inside outer batch — fn not called yet
      expect(fn).not.toHaveBeenCalled();
      s.set(3);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s()).toBe(3);
  });
});

// ── untrack ────────────────────────────────────────────────────────────
describe('untrack', () => {
  it('reads signal without tracking', () => {
    const a = signal(1);
    const b = signal(10);
    const fn = vi.fn(() => { untrack(() => b()); a(); });
    effect(fn);
    fn.mockClear();

    b.set(20); // b is untracked — should NOT trigger
    expect(fn).not.toHaveBeenCalled();

    a.set(2);  // a is tracked — should trigger
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── createStore ────────────────────────────────────────────────────────
describe('createStore', () => {
  it('holds initial state', () => {
    const store = createStore({ count: 0, name: 'test' });
    expect(store.get().count).toBe(0);
    expect(store.get().name).toBe('test');
  });

  it('patches state with set()', () => {
    const store = createStore({ count: 0, flag: false });
    store.set({ count: 5 });
    expect(store.get().count).toBe(5);
    expect(store.get().flag).toBe(false);
  });

  it('select() returns computed signal for a key', () => {
    const store = createStore({ value: 42 });
    const val = store.select('value');
    expect(val()).toBe(42);
    store.set({ value: 100 });
    expect(val()).toBe(100);
  });

  it('reset() reverts to initial state', () => {
    const store = createStore({ x: 1 });
    store.set({ x: 99 });
    store.reset();
    expect(store.get().x).toBe(1);
  });
});
