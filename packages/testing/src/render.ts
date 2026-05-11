import type { Signal } from '@drishti/runtime';

// ── RenderResult ───────────────────────────────────────────────────────

export interface RenderResult {
  container:  HTMLElement;
  getBy(selector: string): HTMLElement;
  getAllBy(selector: string): HTMLElement[];
  queryBy(selector: string): HTMLElement | null;
  getByText(text: string): HTMLElement;
  getByRole(role: string, opts?: { name?: string }): HTMLElement;
  getByLabel(labelText: string): HTMLElement;
  click(el: HTMLElement): void;
  type(el: HTMLElement, text: string): void;
  clear(el: HTMLElement): void;
  focus(el: HTMLElement): void;
  blur(el: HTMLElement): void;
  keyDown(el: HTMLElement, key: string): void;
  unmount(): void;
}

export interface RenderOptions {
  container?: HTMLElement;
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildQueries(container: HTMLElement): Pick<RenderResult, 'getBy' | 'getAllBy' | 'queryBy' | 'getByText' | 'getByRole' | 'getByLabel'> {
  return {
    getBy(selector: string): HTMLElement {
      const el = container.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`getBy: no element found for selector "${selector}"`);
      return el;
    },

    getAllBy(selector: string): HTMLElement[] {
      const els = Array.from(container.querySelectorAll<HTMLElement>(selector));
      if (els.length === 0) throw new Error(`getAllBy: no elements found for selector "${selector}"`);
      return els;
    },

    queryBy(selector: string): HTMLElement | null {
      return container.querySelector<HTMLElement>(selector);
    },

    getByText(text: string): HTMLElement {
      // Collect all matching elements and return the deepest (most specific) one
      const matches: HTMLElement[] = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      let node: Node | null = walker.nextNode();
      while (node !== null) {
        const el = node as HTMLElement;
        if (el.textContent?.trim() === text) matches.push(el);
        node = walker.nextNode();
      }
      if (matches.length === 0) throw new Error(`getByText: no element found with text "${text}"`);
      // Return the deepest element (last in document order that matches = most specific)
      return matches[matches.length - 1]!;
    },

    getByRole(role: string, opts?: { name?: string }): HTMLElement {
      const els = Array.from(container.querySelectorAll<HTMLElement>(`[role="${role}"]`));
      if (opts?.name !== undefined) {
        const name = opts.name;
        const filtered = els.filter(el => {
          const label = el.getAttribute('aria-label') ?? '';
          return label.includes(name);
        });
        if (filtered.length === 0) throw new Error(`getByRole: no element found with role "${role}" and name "${opts.name}"`);
        return filtered[0]!;
      }
      if (els.length === 0) throw new Error(`getByRole: no element found with role "${role}"`);
      return els[0]!;
    },

    getByLabel(labelText: string): HTMLElement {
      // Walk all label elements in the container
      const labels = Array.from(container.querySelectorAll<HTMLLabelElement>('label'));
      for (const label of labels) {
        if (label.textContent?.trim() === labelText) {
          // Try 'for' attribute
          const forAttr = label.getAttribute('for');
          if (forAttr) {
            const input = document.getElementById(forAttr) as HTMLElement | null;
            if (input) return input;
          }
          // Try nested input
          const nested = label.querySelector<HTMLElement>('input, select, textarea');
          if (nested) return nested;
        }
      }
      throw new Error(`getByLabel: no input found for label "${labelText}"`);
    },
  };
}

// ── render ─────────────────────────────────────────────────────────────

export function render(
  component: HTMLElement | (() => HTMLElement),
  opts?: RenderOptions,
): RenderResult {
  let container: HTMLElement;
  if (opts?.container !== undefined) {
    container = opts.container;
  } else {
    container = document.createElement('div');
    document.body.appendChild(container);
  }

  const el = typeof component === 'function' ? component() : component;
  container.appendChild(el);

  const queries = buildQueries(container);

  return {
    container,
    ...queries,

    click(el: HTMLElement): void {
      fireEvent.click(el);
    },

    type(el: HTMLElement, text: string): void {
      const input = el as HTMLInputElement;
      for (const char of text) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        input.value = (input.value ?? '') + char;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      }
    },

    clear(el: HTMLElement): void {
      (el as HTMLInputElement).value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },

    focus(el: HTMLElement): void {
      fireEvent.focus(el);
    },

    blur(el: HTMLElement): void {
      fireEvent.blur(el);
    },

    keyDown(el: HTMLElement, key: string): void {
      fireEvent.keyDown(el, key);
    },

    unmount(): void {
      container.remove();
    },
  };
}

// ── waitFor ────────────────────────────────────────────────────────────

export function waitFor(
  condition: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (condition()) { resolve(); return; }
    const start = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        reject(new Error(`waitFor: condition not met within ${timeoutMs}ms`));
      }
    }, 10);
  });
}

// ── waitForSignal ──────────────────────────────────────────────────────

export function waitForSignal<T>(
  sig: Signal<T>,
  expected: T | ((v: T) => boolean),
  timeoutMs = 1000,
): Promise<void> {
  const check = typeof expected === 'function'
    ? (expected as (v: T) => boolean)
    : (v: T) => v === expected;

  return waitFor(() => check(sig()), timeoutMs);
}

// ── fireEvent ──────────────────────────────────────────────────────────

export const fireEvent: {
  click(el: HTMLElement): void;
  input(el: HTMLElement, value: string): void;
  change(el: HTMLElement, value: string): void;
  keyDown(el: HTMLElement, key: string, opts?: KeyboardEventInit): void;
  keyUp(el: HTMLElement, key: string, opts?: KeyboardEventInit): void;
  submit(el: HTMLElement): void;
  focus(el: HTMLElement): void;
  blur(el: HTMLElement): void;
  mouseEnter(el: HTMLElement): void;
  mouseLeave(el: HTMLElement): void;
} = {
  click(el: HTMLElement): void {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  },

  input(el: HTMLElement, value: string): void {
    (el as HTMLInputElement).value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },

  change(el: HTMLElement, value: string): void {
    (el as HTMLInputElement).value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },

  keyDown(el: HTMLElement, key: string, opts?: KeyboardEventInit): void {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
  },

  keyUp(el: HTMLElement, key: string, opts?: KeyboardEventInit): void {
    el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...opts }));
  },

  submit(el: HTMLElement): void {
    el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  },

  focus(el: HTMLElement): void {
    (el as HTMLElement).focus();
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  },

  blur(el: HTMLElement): void {
    (el as HTMLElement).blur();
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  },

  mouseEnter(el: HTMLElement): void {
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  },

  mouseLeave(el: HTMLElement): void {
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
  },
};

// ── screen ─────────────────────────────────────────────────────────────

export function screen(
  container?: HTMLElement,
): Pick<RenderResult, 'getBy' | 'getAllBy' | 'queryBy' | 'getByText' | 'getByRole' | 'getByLabel'> {
  const root = container ?? document.body;
  return buildQueries(root);
}
