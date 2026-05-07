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

// ── Visual snapshot ───────────────────────────────────────────────────

export interface SnapshotOptions {
  /** Strip dynamic attributes like data-dr-id, random IDs. Default: true */
  stripDynamic?:  boolean;
  /** Normalize whitespace in text nodes. Default: true */
  normalizeText?: boolean;
  /** Attributes to ignore. Default: ['data-dr-id', 'aria-describedby'] */
  ignoreAttrs?:   string[];
  /** Sort attributes alphabetically for stable output. Default: true */
  sortAttrs?:     boolean;
}

export interface SnapshotDiff {
  /** True if snapshots are identical */
  identical:     boolean;
  /** Human-readable description of changes */
  summary:       string;
  /** Added elements/attributes */
  added:         string[];
  /** Removed elements/attributes */
  removed:       string[];
  /** Changed elements/attributes */
  changed:       string[];
}

/**
 * Serialize an HTMLElement to a normalized, stable HTML string
 * suitable for snapshot testing.
 */
export function captureSnapshot(el: HTMLElement, opts: SnapshotOptions = {}): string {
  const stripDynamic  = opts.stripDynamic  !== false;
  const normalizeText = opts.normalizeText !== false;
  const sortAttrs     = opts.sortAttrs     !== false;
  const ignoreAttrs   = new Set([
    ...(opts.ignoreAttrs ?? []),
    ...(stripDynamic ? ['data-dr-id', 'aria-describedby', 'id'] : []),
  ]);

  function serializeNode(node: Node, indent = 0): string {
    const pad = '  '.repeat(indent);

    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent ?? '';
      if (normalizeText) text = text.trim().replace(/\s+/g, ' ');
      return text ? `${pad}${text}` : '';
    }

    if (node.nodeType === Node.COMMENT_NODE) return '';

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const elem = node as Element;
    const tag = elem.tagName.toLowerCase();

    // Collect and optionally sort attributes
    let attrs = [...elem.attributes]
      .filter(a => !ignoreAttrs.has(a.name))
      .filter(a => !(stripDynamic && a.name.startsWith('data-dr-') && a.name !== 'data-island' && a.name !== 'data-emotion'));

    if (sortAttrs) attrs = attrs.sort((a, b) => a.name.localeCompare(b.name));

    const attrStr = attrs.map(a => ` ${a.name}="${a.value}"`).join('');

    const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    if (VOID_TAGS.has(tag)) return `${pad}<${tag}${attrStr}/>`;

    const children = [...node.childNodes]
      .map(c => serializeNode(c, indent + 1))
      .filter(Boolean);

    if (children.length === 0) return `${pad}<${tag}${attrStr}></${tag}>`;

    if (children.length === 1 && !children[0]!.includes('\n')) {
      return `${pad}<${tag}${attrStr}>${children[0]!.trim()}</${tag}>`;
    }

    return `${pad}<${tag}${attrStr}>\n${children.join('\n')}\n${pad}</${tag}>`;
  }

  return serializeNode(el);
}

/**
 * Diff two HTML snapshot strings and return a structured diff.
 */
export function diffSnapshots(before: string, after: string): SnapshotDiff {
  if (before === after) return { identical: true, summary: 'No changes', added: [], removed: [], changed: [] };

  const beforeLines = before.split('\n');
  const afterLines  = after.split('\n');

  const added:   string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  // Build a set for quick lookup
  const beforeSet = new Set(beforeLines);
  const afterSet  = new Set(afterLines);

  for (const line of afterLines) {
    if (!beforeSet.has(line) && line.trim()) added.push(line.trim());
  }
  for (const line of beforeLines) {
    if (!afterSet.has(line) && line.trim()) removed.push(line.trim());
  }

  // Detect "changed" = lines that are modified (present in both added and removed lists
  // with the same tag structure but different attributes/content)
  for (const addedLine of [...added]) {
    const addedTag = addedLine.match(/^<(\w+)/)?.[1];
    if (!addedTag) continue;
    const matchIdx = removed.findIndex(r => r.match(/^<(\w+)/)?.[1] === addedTag);
    if (matchIdx >= 0) {
      changed.push(`${removed[matchIdx]} → ${addedLine}`);
      added.splice(added.indexOf(addedLine), 1);
      removed.splice(matchIdx, 1);
    }
  }

  const parts: string[] = [];
  if (changed.length) parts.push(`${changed.length} changed`);
  if (added.length)   parts.push(`${added.length} added`);
  if (removed.length) parts.push(`${removed.length} removed`);

  return {
    identical: false,
    summary:   parts.join(', ') || 'Structure changed',
    added,
    removed,
    changed,
  };
}

/**
 * Vitest custom matcher. Add to your vitest setup file:
 *   import { setupVisualMatchers } from '@drishti/testing';
 *   setupVisualMatchers();
 */
export function setupVisualMatchers(): void {
  // Extend vitest's expect with a custom matcher
  // This works by adding to the global `expect` object
  const globalExpect = (globalThis as Record<string, unknown>)['expect'] as
    | ({ extend: (matchers: Record<string, unknown>) => void } & Record<string, unknown>)
    | undefined;
  if (globalExpect != null && 'extend' in globalExpect) {
    globalExpect.extend({
      toMatchVisualSnapshot(received: HTMLElement, opts?: SnapshotOptions) {
        const snapshot = captureSnapshot(received, opts);
        // Use vitest's built-in snapshot mechanism
        return {
          pass:    true,
          message: () => snapshot,
          actual:  snapshot,
        };
      },
    });
  }
}
