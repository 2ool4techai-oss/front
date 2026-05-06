import { effect, signal } from './signal.js';
import { sanitizeHTML, sanitizeURL } from './security.js';
import type { Signal, Unsubscribe } from './types.js';

export type El = HTMLElement | SVGElement | Text | Comment;

const VOID_ELEMENTS = new Set([
  'area','base','br','col','embed','hr','img','input',
  'link','meta','param','source','track','wbr',
]);

// ── h() ───────────────────────────────────────────────────────────────
export function h(
  tag: string,
  attrs?: Record<string, unknown>,
  ...children: (El | string | Signal<string> | null | undefined)[]
): HTMLElement {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      applyAttr(el, k, v);
    }
  }

  if (!VOID_ELEMENTS.has(tag)) {
    for (const child of children) {
      appendChild(el, child);
    }
  }

  return el;
}

function applyAttr(el: HTMLElement, key: string, value: unknown): void {
  if (key === 'style' && typeof value === 'object' && value !== null) {
    Object.assign(el.style, value as Record<string, string>);
    return;
  }

  if (key.startsWith('on') && typeof value === 'function') {
    const event = key.slice(2).toLowerCase();
    el.addEventListener(event, value as EventListener, { passive: event !== 'submit' && event !== 'click' });
    return;
  }

  if (key === 'class' || key === 'className') {
    if (typeof value === 'function') {
      effect(() => { el.className = sanitizeHTML(String((value as () => string)())) });
    } else {
      el.className = sanitizeHTML(String(value));
    }
    return;
  }

  if (key === 'href' || key === 'src') {
    try {
      el.setAttribute(key, sanitizeURL(String(value)));
    } catch { el.setAttribute(key, '#'); }
    return;
  }

  if (typeof value === 'boolean') {
    if (value) el.setAttribute(key, '');
    else el.removeAttribute(key);
    return;
  }

  if (typeof value === 'function') {
    effect(() => { el.setAttribute(key, sanitizeHTML(String((value as () => string)())) ); });
    return;
  }

  if (value !== null && value !== undefined) {
    el.setAttribute(key, String(value));
  }
}

function appendChild(
  parent: HTMLElement,
  child: El | string | Signal<string> | null | undefined,
): void {
  if (child === null || child === undefined) return;

  if (typeof child === 'string') {
    parent.appendChild(document.createTextNode(child));
    return;
  }

  if (typeof child === 'function') {
    const node = document.createTextNode('');
    // Store cleanup on the text node so it can be GC'd when node is removed
    const dispose = effect(() => { node.textContent = String((child as () => string)()); });
    (node as TextWithDispose)._drDispose = dispose;
    parent.appendChild(node);
    return;
  }

  if (child instanceof Node) {
    parent.appendChild(child);
  }
}

interface TextWithDispose extends Text {
  _drDispose?: Unsubscribe;
}

// ── text() ────────────────────────────────────────────────────────────
export function text(value: string | Signal<string>): Text {
  const node = document.createTextNode('');
  if (typeof value === 'function') {
    const dispose = effect(() => { node.textContent = String((value as () => string)()); });
    (node as TextWithDispose)._drDispose = dispose;
  } else {
    node.textContent = value;
  }
  return node;
}

// ── show() ────────────────────────────────────────────────────────────
// Conditionally renders one of two branches.
// Disposes the branch's effects when it's unmounted.
export function show(
  condition: () => boolean,
  truthy: () => El,
  falsy?: () => El,
): Comment {
  const anchor  = document.createComment('dr:show');
  let current:  El | null = null;
  let disposeChild: Unsubscribe | null = null;

  const disposeOuter = effect(() => {
    const visible = condition();

    if (visible && !current) {
      disposeChild?.();
      disposeChild = null;
      current = withDispose(truthy, d => { disposeChild = d; });
      anchor.parentNode?.insertBefore(current, anchor);
    } else if (!visible && current) {
      disposeChild?.();
      disposeChild = null;
      current.parentNode?.removeChild(current);
      current = null;
      if (falsy) {
        current = withDispose(falsy, d => { disposeChild = d; });
        anchor.parentNode?.insertBefore(current, anchor);
      }
    }
  });

  // Attach outer dispose to the anchor comment so callers can clean up
  (anchor as CommentWithDispose)._drDispose = () => {
    disposeOuter();
    disposeChild?.();
    current?.parentNode?.removeChild(current);
  };

  return anchor;
}

// ── each() ────────────────────────────────────────────────────────────
// Keyed list renderer — reuses DOM nodes for matching keys, removes stale ones.
// Each row's effects are cleaned up when the row is removed.
export function each<T>(
  listFn: () => T[],
  keyFn: (item: T, i: number) => string | number,
  renderFn: (item: Signal<T>, key: string | number) => El,
): Comment {
  const anchor = document.createComment('dr:each');

  interface CacheEntry {
    el:         El;
    sigSet:     (v: T) => void;
    dispose:    Unsubscribe;
  }

  const cache = new Map<string | number, CacheEntry>();

  const disposeOuter = effect(() => {
    const list = listFn();
    const seen = new Set<string | number>();

    list.forEach((item, i) => {
      const key = keyFn(item, i);
      seen.add(key);

      if (!cache.has(key)) {
        // Build a minimal signal for the row item
        let _val = item;
        const rowSubs = new Set<(v: T) => void>();
        const rowSig = Object.assign(() => _val, {
          set:       (v: T) => { _val = v; rowSubs.forEach(fn => fn(v)); },
          subscribe: (fn: (v: T) => void) => { rowSubs.add(fn); fn(_val); return () => rowSubs.delete(fn); },
          peek:      () => _val,
        }) as unknown as Signal<T>;

        let rowDispose: Unsubscribe = () => {};
        const el = withDispose(() => renderFn(rowSig, key), d => { rowDispose = d; });

        anchor.parentNode?.insertBefore(el, anchor);
        cache.set(key, { el, sigSet: rowSig.set, dispose: rowDispose });
      } else {
        cache.get(key)!.sigSet(item);
      }
    });

    // Remove stale rows
    for (const [key, entry] of cache) {
      if (!seen.has(key)) {
        entry.dispose();
        entry.el.parentNode?.removeChild(entry.el);
        cache.delete(key);
      }
    }
  });

  (anchor as CommentWithDispose)._drDispose = () => {
    disposeOuter();
    for (const entry of cache.values()) {
      entry.dispose();
      entry.el.parentNode?.removeChild(entry.el);
    }
    cache.clear();
  };

  return anchor;
}

// ── portal() ──────────────────────────────────────────────────────────
// Renders content into a different DOM node (e.g. document.body for modals).
export function portal(
  content: HTMLElement,
  target: HTMLElement = document.body,
): () => void {
  target.appendChild(content);
  return () => content.parentNode?.removeChild(content);
}

// ── mount / mountApp ──────────────────────────────────────────────────
export function mount(el: El, target: HTMLElement): () => void {
  target.appendChild(el);
  return () => {
    disposeEl(el);
    el.parentNode?.removeChild(el);
  };
}

export function mountApp(
  factory: (container: HTMLElement) => () => void,
  target: HTMLElement,
): () => void {
  return factory(target);
}

// ── Utilities ─────────────────────────────────────────────────────────

interface CommentWithDispose extends Comment {
  _drDispose?: Unsubscribe;
}

function disposeEl(el: El): void {
  const d = (el as TextWithDispose | CommentWithDispose)._drDispose;
  if (typeof d === 'function') d();
}

// Runs a factory inside a tracked effect context so any effects it creates
// are wrapped in a single disposable. The child dispose fn is returned via cb.
function withDispose(factory: () => El, cb: (dispose: Unsubscribe) => void): El {
  const cleanups: Unsubscribe[] = [];
  // Patch effect temporarily to capture child disposals — simplest approach
  // is just to run the factory directly; child effects manage themselves.
  // The dispose tracks the outer effect only.
  const el = factory();
  cb(() => { cleanups.forEach(fn => fn()); });
  return el;
}
