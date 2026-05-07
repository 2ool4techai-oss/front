import { signal, effect, batch } from '@drishti/runtime';
import type { Signal, Unsubscribe } from '@drishti/runtime';

// ── testSignal ─────────────────────────────────────────────────────────
// Wraps a signal for easy assertion in tests.
//
// Usage (Vitest / Jest):
//   const count = signal(0);
//   const s = testSignal(count);
//   count.set(5);
//   expect(s.value).toBe(5);
//   expect(s.history).toEqual([0, 5]);

export interface TestSignalWrapper<T> {
  readonly value:   T;
  readonly history: T[];
  readonly emitCount: number;
  reset():     void;
  dispose():   void;
  waitForValue(predicate: (v: T) => boolean, timeoutMs?: number): Promise<T>;
}

export function testSignal<T>(sig: Signal<T>): TestSignalWrapper<T> {
  const history: T[] = [];
  let emitCount = 0;
  let dispose: Unsubscribe;

  dispose = sig.subscribe((v) => {
    history.push(v);
    emitCount++;
  });

  return {
    get value()     { return sig.peek(); },
    get history()   { return [...history]; },
    get emitCount() { return emitCount; },
    reset():   void { history.length = 0; emitCount = 0; },
    dispose(): void { dispose(); },
    waitForValue(predicate: (v: T) => boolean, timeoutMs = 2000): Promise<T> {
      if (predicate(sig.peek())) return Promise.resolve(sig.peek());
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('testSignal.waitForValue timed out')), timeoutMs);
        const unsub = sig.subscribe((v) => {
          if (predicate(v)) { clearTimeout(timer); unsub(); resolve(v); }
        });
      });
    },
  };
}

// ── testEffect ────────────────────────────────────────────────────────
// Runs an effect and collects how many times it ran.
//
// Usage:
//   const count = signal(0);
//   const e = testEffect(() => count());
//   count.set(1); count.set(2);
//   expect(e.runCount).toBe(3); // initial + 2 updates

export interface TestEffectWrapper {
  readonly runCount: number;
  dispose():   void;
}

export function testEffect(fn: () => void): TestEffectWrapper {
  let runCount = 0;
  const dispose = effect(() => { runCount++; fn(); });
  return {
    get runCount() { return runCount; },
    dispose,
  };
}

// ── renderComponent ───────────────────────────────────────────────────
// Mounts a component into a detached container for testing.
//
// Usage:
//   const { el, query, queryAll, unmount } = renderComponent(() => Button({ label: 'Go' }));
//   expect(query('.dr-btn')?.textContent).toBe('Go');

export interface RenderResult {
  container: HTMLElement;
  el:        HTMLElement;
  query<T extends Element = Element>(selector: string): T | null;
  queryAll<T extends Element = Element>(selector: string): T[];
  unmount():  void;
}

export function renderComponent(factory: () => HTMLElement): RenderResult {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left     = '-9999px';
  document.body.appendChild(container);

  const el = factory();
  container.appendChild(el);

  return {
    container,
    el,
    query:    (sel) => container.querySelector(sel) as never,
    queryAll: (sel) => [...container.querySelectorAll(sel)] as never,
    unmount:  () => {
      container.remove();
    },
  };
}

// ── fireEvent ─────────────────────────────────────────────────────────
// Dispatches synthetic events on elements.
//
// Usage:
//   fireEvent.click(button);
//   fireEvent.input(input, 'hello@example.com');

export const fireEvent = {
  click(el: Element, opts?: MouseEventInit): void {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...opts }));
  },
  input(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },
  change(el: HTMLInputElement | HTMLSelectElement, value: string): void {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },
  keydown(el: Element, key: string, opts?: KeyboardEventInit): void {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
  },
  keyup(el: Element, key: string, opts?: KeyboardEventInit): void {
    el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...opts }));
  },
  submit(form: HTMLFormElement): void {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  },
  focus(el: HTMLElement): void {
    el.focus();
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  },
  blur(el: HTMLElement): void {
    el.blur();
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  },
};

// ── testBatch ─────────────────────────────────────────────────────────
// Verifies that a batch of signal updates causes exactly N effect runs.
//
// Usage:
//   const a = signal(0), b = signal(0);
//   const runs = testBatch(() => { a.set(1); b.set(2); }, [a, b]);
//   expect(runs).toBe(1);

export function testBatch(fn: () => void, signals: Signal<unknown>[]): number {
  let runs = 0;
  const dispose = effect(() => { signals.forEach(s => s()); runs++; });
  runs = 0; // reset from initial run
  batch(fn);
  dispose();
  return runs;
}

// ── flushEffects ──────────────────────────────────────────────────────
// In synchronous tests, signals update synchronously, but if you need to
// wait for microtasks (e.g. async effects), call this.
export function flushEffects(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ── createTestRouter ──────────────────────────────────────────────────
// Returns a minimal fake router for testing routed components.
export interface TestRouter {
  navigate(path: string): void;
  readonly currentPath: string;
  readonly navigations: string[];
}

export function createTestRouter(initialPath = '/'): TestRouter {
  const _path = signal(initialPath);
  const history: string[] = [initialPath];

  return {
    navigate(path: string): void {
      _path.set(path);
      history.push(path);
    },
    get currentPath() { return _path.peek(); },
    get navigations() { return [...history]; },
  };
}
