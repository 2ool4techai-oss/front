import { signal, computed, effect } from './signal.js';
import type { Signal, ComputedSignal, Unsubscribe } from './types.js';

// ── memo() ─────────────────────────────────────────────────────────────
// Like computed() but only recomputes when deps actually change.
// Accepts a custom equality fn for deep comparison.
export function memo<T>(
  fn: () => T,
  eq: (a: T, b: T) => boolean = Object.is,
): ComputedSignal<T> {
  let last: T | undefined;
  let hasValue = false;
  return computed(() => {
    const next = fn();
    if (hasValue && eq(last as T, next)) return last as T;
    last = next;
    hasValue = true;
    return next;
  });
}

// ── debounce() ────────────────────────────────────────────────────────
// Returns a new signal that only updates after `ms` ms of silence.
export function debounce<T>(source: Signal<T>, ms: number): Signal<T> {
  const out = signal(source.peek());
  let timer: ReturnType<typeof setTimeout> | null = null;
  source.subscribe((v) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { out.set(v); timer = null; }, ms);
  });
  return out;
}

// ── throttle() ────────────────────────────────────────────────────────
// Returns a signal that passes through at most one update per `ms` interval.
export function throttle<T>(source: Signal<T>, ms: number): Signal<T> {
  const out = signal(source.peek());
  let last = 0;
  let pending: { v: T; timer: ReturnType<typeof setTimeout> } | null = null;

  source.subscribe((v) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      out.set(v);
      return;
    }
    if (pending) clearTimeout(pending.timer);
    pending = {
      v,
      timer: setTimeout(() => {
        last = Date.now();
        out.set(v);
        pending = null;
      }, ms - (now - last)),
    };
  });
  return out;
}

// ── distinct() ────────────────────────────────────────────────────────
// Filters out consecutive duplicate values from a signal.
export function distinct<T>(source: Signal<T>, eq: (a: T, b: T) => boolean = Object.is): Signal<T> {
  const out = signal(source.peek());
  source.subscribe((v) => { if (!eq(out.peek(), v)) out.set(v); });
  return out;
}

// ── fromEvent() ───────────────────────────────────────────────────────
// Creates a signal from a DOM event. Signal value = last event payload.
export function fromEvent<T extends Event>(
  target: EventTarget,
  type:   string,
  transform: (e: T) => unknown = (e) => e,
  initial?: unknown,
): { signal: Signal<unknown>; destroy: () => void } {
  const sig = signal<unknown>(initial ?? null);
  const handler = (e: Event) => sig.set(transform(e as T) as unknown);
  target.addEventListener(type, handler);
  return {
    signal: sig,
    destroy: () => target.removeEventListener(type, handler),
  };
}

// ── virtual() ─────────────────────────────────────────────────────────
// Virtualized list renderer — only renders items in the visible window.
// Critical for performance with large datasets (1000+ rows).

export interface VirtualListConfig<T> {
  items:      () => T[];
  itemHeight: number;          // px, fixed height required
  overscan?:  number;          // extra rows to render above/below (default 3)
  renderItem: (item: T, index: number) => HTMLElement;
  container?: HTMLElement;     // if provided, uses it instead of creating one
  class?:     string;
}

export interface VirtualList {
  el:      HTMLElement;
  destroy: () => void;
  scrollTo(index: number): void;
}

export function virtual<T>(cfg: VirtualListConfig<T>): VirtualList {
  const overscan = cfg.overscan ?? 3;
  const h        = cfg.itemHeight;

  const outer = cfg.container ?? document.createElement('div');
  outer.style.cssText += 'overflow-y:auto;position:relative;';
  if (cfg.class && !cfg.container) outer.className = cfg.class;

  const inner = document.createElement('div');
  inner.style.position = 'relative';
  outer.appendChild(inner);

  let renderedStart = -1;
  let renderedEnd   = -1;
  const cache = new Map<number, HTMLElement>();

  const render = () => {
    const items    = cfg.items();
    const total    = items.length;
    const scrollTop = outer.scrollTop;
    const height   = outer.clientHeight || 400;

    inner.style.height = `${total * h}px`;

    const start = Math.max(0, Math.floor(scrollTop / h) - overscan);
    const end   = Math.min(total - 1, Math.ceil((scrollTop + height) / h) + overscan);

    if (start === renderedStart && end === renderedEnd) return;

    // Remove out-of-view items
    for (const [i, el] of cache) {
      if (i < start || i > end) { el.remove(); cache.delete(i); }
    }

    // Add newly-visible items
    for (let i = start; i <= end; i++) {
      if (!cache.has(i)) {
        const item = items[i];
        if (item === undefined) continue;
        const el = cfg.renderItem(item, i);
        el.style.position  = 'absolute';
        el.style.top       = `${i * h}px`;
        el.style.left      = '0';
        el.style.right     = '0';
        el.style.height    = `${h}px`;
        inner.appendChild(el);
        cache.set(i, el);
      }
    }

    renderedStart = start;
    renderedEnd   = end;
  };

  const onScroll = () => render();
  outer.addEventListener('scroll', onScroll, { passive: true });

  // Re-render when items signal changes
  let disposeEffect: Unsubscribe | null = null;
  disposeEffect = effect(() => {
    cfg.items(); // track
    renderedStart = -1; renderedEnd = -1;
    render();
  });

  const ro = new ResizeObserver(() => render());
  ro.observe(outer);

  return {
    el: outer,
    destroy: () => {
      disposeEffect?.();
      ro.disconnect();
      outer.removeEventListener('scroll', onScroll);
      cache.clear();
    },
    scrollTo: (index: number) => {
      outer.scrollTop = index * h;
    },
  };
}

// ── lazy() ────────────────────────────────────────────────────────────
// Returns a derived signal that is computed only when first read,
// then cached until dependencies change.
export function lazy<T>(fn: () => T): ComputedSignal<T> {
  return computed(fn); // computed() is already lazy by nature
}

// ── once() ────────────────────────────────────────────────────────────
// Subscribes to a signal, fires handler the first time, then unsubscribes.
export function once<T>(sig: Signal<T>, handler: (v: T) => void): Unsubscribe {
  let done = false;
  const unsub = sig.subscribe((v) => {
    if (done) return;
    done = true;
    unsub();
    handler(v);
  });
  return unsub;
}

// ── when() ────────────────────────────────────────────────────────────
// Resolves a Promise when the signal satisfies a predicate.
export function when<T>(sig: Signal<T>, predicate: (v: T) => boolean): Promise<T> {
  if (predicate(sig.peek())) return Promise.resolve(sig.peek());
  return new Promise<T>((resolve) => {
    const unsub = sig.subscribe((v) => {
      if (predicate(v)) { unsub(); resolve(v); }
    });
  });
}
