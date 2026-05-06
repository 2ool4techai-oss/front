import type { Signal, ComputedSignal, SignalSubscriber, Unsubscribe } from './types.js';

type EffectFn = () => void;

let currentEffect: EffectFn | null = null;
const effectDeps = new WeakMap<EffectFn, Set<Set<EffectFn>>>();

function trackAccess(subs: Set<EffectFn>): void {
  if (currentEffect) {
    subs.add(currentEffect);
    const deps = effectDeps.get(currentEffect);
    if (deps) deps.add(subs);
  }
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<EffectFn>();
  const listeners = new Set<SignalSubscriber<T>>();

  const notify = () => {
    for (const fn of subs) fn();
    for (const fn of listeners) fn(value);
  };

  const sig = Object.assign(
    function (): T {
      trackAccess(subs);
      return value;
    },
    {
      peek: (): T => value,
      set: (next: T): void => {
        if (Object.is(value, next)) return;
        value = next;
        notify();
      },
      subscribe: (fn: SignalSubscriber<T>): Unsubscribe => {
        listeners.add(fn);
        fn(value);
        return () => listeners.delete(fn);
      },
    },
  ) as Signal<T>;

  return sig;
}

export function computed<T>(fn: () => T): ComputedSignal<T> {
  let value: T;
  let dirty = true;
  const subs = new Set<EffectFn>();
  const listeners = new Set<SignalSubscriber<T>>();
  const ownDeps = new Set<Set<EffectFn>>();

  const recompute: EffectFn = () => {
    dirty = true;
    for (const fn2 of subs) fn2();
    if (listeners.size > 0) {
      const next = get();
      for (const fn2 of listeners) fn2(next);
    }
  };

  const get = (): T => {
    if (dirty) {
      for (const depSet of ownDeps) depSet.delete(recompute);
      ownDeps.clear();

      const prev = currentEffect;
      currentEffect = recompute;
      effectDeps.set(recompute, ownDeps);
      try {
        value = fn();
      } finally {
        currentEffect = prev;
      }
      dirty = false;
    }
    trackAccess(subs);
    return value!;
  };

  const sig = Object.assign(
    function (): T { return get(); },
    {
      isComputed: true as const,
      peek: (): T => { if (dirty) return get(); return value!; },
      set: (_: T): void => { throw new Error('[DRISHTI] computed signals are read-only'); },
      subscribe: (cb: SignalSubscriber<T>): Unsubscribe => {
        listeners.add(cb);
        cb(get());
        return () => listeners.delete(cb);
      },
    },
  ) as ComputedSignal<T>;

  return sig;
}

export function effect(fn: () => void | (() => void)): Unsubscribe {
  let cleanup: (() => void) | void;
  const trackedDeps = new Set<Set<EffectFn>>();
  let disposed = false;

  const run: EffectFn = () => {
    if (disposed) return;
    if (typeof cleanup === 'function') cleanup();

    for (const dep of trackedDeps) dep.delete(run);
    trackedDeps.clear();

    const prev = currentEffect;
    currentEffect = run;
    effectDeps.set(run, trackedDeps);
    try {
      cleanup = fn();
    } finally {
      currentEffect = prev;
    }
  };

  run();

  return () => {
    disposed = true;
    if (typeof cleanup === 'function') cleanup();
    for (const dep of trackedDeps) dep.delete(run);
    trackedDeps.clear();
  };
}

export function batch(fn: () => void): void {
  fn();
}
