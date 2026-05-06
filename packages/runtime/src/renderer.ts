import { effect } from './signal.js';
import { sanitizeHTML, sanitizeURL } from './security.js';
import type { Signal } from './types.js';

export type El = HTMLElement | SVGElement | Text | Comment;

export interface MountOptions {
  target: HTMLElement;
  hydrate?: boolean;
}

const VOID_ELEMENTS = new Set([
  'area','base','br','col','embed','hr','img','input',
  'link','meta','param','source','track','wbr',
]);

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
      const safeURL = sanitizeURL(String(value));
      el.setAttribute(key, safeURL);
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
    const text = document.createTextNode('');
    effect(() => { text.textContent = String((child as () => string)()); });
    parent.appendChild(text);
    return;
  }

  if (child instanceof Node) {
    parent.appendChild(child);
  }
}

export function text(value: string | Signal<string>): Text {
  const node = document.createTextNode('');
  if (typeof value === 'function') {
    effect(() => { node.textContent = String((value as () => string)()); });
  } else {
    node.textContent = value;
  }
  return node;
}

export function show(
  condition: () => boolean,
  truthy: () => El,
  falsy?: () => El,
): Comment {
  const anchor = document.createComment('dr:show');
  let current: El | null = null;

  effect(() => {
    const show = condition();
    if (show && !current) {
      current = truthy();
      anchor.parentNode?.insertBefore(current, anchor.nextSibling ?? anchor);
    } else if (!show && current) {
      current.parentNode?.removeChild(current);
      current = null;
      if (falsy) {
        current = falsy();
        anchor.parentNode?.insertBefore(current, anchor.nextSibling ?? anchor);
      }
    }
  });

  return anchor;
}

export function each<T>(
  listFn: () => T[],
  keyFn: (item: T, i: number) => string | number,
  renderFn: (item: Signal<T>, key: string | number) => El,
): Comment {
  const anchor = document.createComment('dr:each');
  const cache = new Map<string | number, { el: El; signal: { set: (v: T) => void } }>();

  effect(() => {
    const list = listFn();
    const seen = new Set<string | number>();

    list.forEach((item, i) => {
      const key = keyFn(item, i);
      seen.add(key);

      if (!cache.has(key)) {
        let _val = item;
        const subs = new Set<(v: T) => void>();
        const sig = Object.assign(() => _val, {
          set: (v: T) => { _val = v; subs.forEach(fn => fn(v)); },
          subscribe: (fn: (v: T) => void) => { subs.add(fn); fn(_val); return () => subs.delete(fn); },
          peek: () => _val,
        }) as unknown as Signal<T>;

        const el = renderFn(sig, key);
        anchor.parentNode?.insertBefore(el, anchor.nextSibling ?? anchor);
        cache.set(key, { el, signal: sig as unknown as { set: (v: T) => void } });
      } else {
        cache.get(key)!.signal.set(item);
      }
    });

    for (const [key, entry] of cache) {
      if (!seen.has(key)) {
        entry.el.parentNode?.removeChild(entry.el);
        cache.delete(key);
      }
    }
  });

  return anchor;
}

export function mount(el: El, target: HTMLElement): () => void {
  target.appendChild(el);
  return () => { el.parentNode?.removeChild(el); };
}

export function mountApp(
  factory: (container: HTMLElement) => () => void,
  target: HTMLElement,
): () => void {
  return factory(target);
}
