import type { Signal, ComputedSignal, SignalSubscriber, Unsubscribe, Store } from './types.js';

type EffectFn = () => void;

let currentEffect: EffectFn | null = null;
const effectDeps = new WeakMap<EffectFn, Set<Set<EffectFn>>>();

// ── Dev registry ───────────────────────────────────────────────────────
export interface _DevSignalEntry {
  label:   string;
  type:    'signal' | 'computed';
  peek:    () => unknown;
  updates: { n: number };
}

let _devMode = false;
const _devSignalMap  = new WeakMap<object, _DevSignalEntry>();
const _devSignalList: _DevSignalEntry[] = [];
export let _totalEffectRuns = 0;

export function _enableDevMode(): void { _devMode = true; }

// ── SSR mode — effects run once, no subscriptions ──────────────────────
let _ssrMode = false;
export function _setSSRMode(v: boolean): void { _ssrMode = v; }
export function _getDevSignals(): readonly _DevSignalEntry[] { return _devSignalList; }

export function label<T>(sig: Signal<T> | ComputedSignal<T>, name: string): typeof sig {
  if (_devMode) {
    const entry = _devSignalMap.get(sig as object);
    if (entry) entry.label = name;
  }
  return sig;
}

// ── Batching ───────────────────────────────────────────────────────────
let batchDepth = 0;
const pendingEffects = new Set<EffectFn>();

function scheduleEffect(fn: EffectFn): void {
  if (batchDepth > 0) {
    pendingEffects.add(fn);
  } else {
    fn();
  }
}

function flushBatch(): void {
  // Snapshot so effects scheduled during flush run next microtask, not infinite-loop here
  const toRun = [...pendingEffects];
  pendingEffects.clear();
  for (const fn of toRun) fn();
}

// ── Tracking ───────────────────────────────────────────────────────────
function trackAccess(subs: Set<EffectFn>): void {
  if (currentEffect) {
    subs.add(currentEffect);
    const deps = effectDeps.get(currentEffect);
    if (deps) deps.add(subs);
  }
}

// ── signal ─────────────────────────────────────────────────────────────
export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<EffectFn>();
  const listeners = new Set<SignalSubscriber<T>>();
  const _uc = { n: 0 };

  const notify = () => {
    if (_devMode) _uc.n++;
    for (const fn of [...subs]) scheduleEffect(fn);
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

  if (_devMode) {
    const entry: _DevSignalEntry = {
      label:   `signal_${_devSignalList.length}`,
      type:    'signal',
      peek:    () => value,
      updates: _uc,
    };
    _devSignalMap.set(sig as object, entry);
    _devSignalList.push(entry);
  }

  return sig;
}

// ── computed ───────────────────────────────────────────────────────────
export function computed<T>(fn: () => T): ComputedSignal<T> {
  let value: T;
  let dirty = true;
  const subs = new Set<EffectFn>();
  const listeners = new Set<SignalSubscriber<T>>();
  const ownDeps = new Set<Set<EffectFn>>();

  const recompute: EffectFn = () => {
    dirty = true;
    for (const fn2 of [...subs]) scheduleEffect(fn2);
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

  if (_devMode) {
    const _uc = { n: 0 };
    const entry: _DevSignalEntry = {
      label:   `computed_${_devSignalList.length}`,
      type:    'computed',
      peek:    () => sig.peek(),
      updates: _uc,
    };
    const origRecompute = recompute;
    // wrap recompute to count updates — already tracked via notify in deps
    _devSignalMap.set(sig as object, entry);
    _devSignalList.push(entry);
    void origRecompute; // satisfy linter
  }

  return sig;
}

// ── effect ─────────────────────────────────────────────────────────────
export function effect(fn: () => void | (() => void)): Unsubscribe {
  let cleanup: (() => void) | void;
  const trackedDeps = new Set<Set<EffectFn>>();
  let disposed = false;

  const run: EffectFn = () => {
    if (disposed) return;
    if (_devMode) _totalEffectRuns++;

    // SSR mode: run once without subscribing to any signals
    if (_ssrMode) {
      const prev = currentEffect;
      currentEffect = null;
      try { fn(); } finally { currentEffect = prev; }
      disposed = true;
      return;
    }

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

// ── batch ──────────────────────────────────────────────────────────────
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) flushBatch();
  }
}

// ── untrack ────────────────────────────────────────────────────────────
export function untrack<T>(fn: () => T): T {
  const prev = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prev;
  }
}

// ── createStore ────────────────────────────────────────────────────────
export function createStore<T extends Record<string, unknown>>(initial: T): Store<T> {
  const _initial = { ...initial };
  const _sig = signal<T>({ ..._initial });

  return {
    get: () => _sig(),
    set: (patch: Partial<T>): void => {
      batch(() => _sig.set({ ..._sig.peek(), ...patch }));
    },
    select: <K extends keyof T>(key: K): ComputedSignal<T[K]> =>
      computed(() => _sig()[key]),
    signal: _sig,
    reset: (): void => _sig.set({ ..._initial }),
  };
}
