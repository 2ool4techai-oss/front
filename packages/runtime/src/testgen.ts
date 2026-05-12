import { signal, effect } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface TestSpec {
  name: string;
  /** Callable test function — throws on assertion failure */
  fn: () => void;
  /** String code representation (vitest-compatible) */
  code: string;
  type: 'unit' | 'interaction' | 'signal' | 'accessibility';
}

// ── Introspection helpers ──────────────────────────────────────────────

/** Detect signal-like objects (has .peek, .set, .subscribe) */
function isSignalLike(value: unknown): boolean {
  if (value === null || (typeof value !== 'function' && typeof value !== 'object')) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['peek']      === 'function' &&
    typeof v['set']       === 'function' &&
    typeof v['subscribe'] === 'function'
  );
}

/** Assert helper — throws with message when condition is false */
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── generateSignalTests ────────────────────────────────────────────────

export function generateSignalTests(signals: Record<string, unknown>): TestSpec[] {
  const specs: TestSpec[] = [];
  const signalKeys = Object.keys(signals).filter(k => isSignalLike(signals[k]));

  if (signalKeys.length === 0) {
    specs.push({
      type: 'signal',
      name: 'no signals found in provided object',
      fn: () => {
        // No-op — informational test
      },
      code: `
it('no signal-like objects found', () => {
  // Pass a Record<string, Signal> to generateSignalTests()
});`.trim(),
    });
    return specs;
  }

  for (const key of signalKeys) {
    const sig     = signals[key] as Signal<unknown>;
    const initVal = sig.peek();
    const typeName = typeof initVal;

    // ── 1. Initial value test ─────────────────────────────────────────
    specs.push({
      type: 'signal',
      name: `signal "${key}" has correct initial value`,
      fn: () => {
        assertEqual(typeof sig(), typeName, `${key} type`);
      },
      code: `
it('signal "${key}" has initial value of type ${typeName}', () => {
  expect(typeof signals['${key}']()).toBe('${typeName}');
  expect(signals['${key}']()).toEqual(${JSON.stringify(initVal)});
});`.trim(),
    });

    // ── 2. Reactivity test ────────────────────────────────────────────
    const nextVal =
      typeName === 'number'   ? (initVal as number) + 1
      : typeName === 'boolean' ? !initVal
      : typeName === 'string'  ? String(initVal) + '_updated'
      : null;

    if (nextVal !== null) {
      specs.push({
        type: 'signal',
        name: `signal "${key}" notifies subscribers on change`,
        fn: () => {
          const calls: unknown[] = [];
          const unsub = sig.subscribe(v => calls.push(v));
          const before = calls.length;
          sig.set(nextVal);
          assert(calls.length > before, `${key} subscriber was not called after set()`);
          assertEqual(calls[calls.length - 1], nextVal, `${key} subscriber value`);
          // Restore
          sig.set(initVal);
          unsub();
        },
        code: `
it('signal "${key}" notifies on change', () => {
  const spy = vi.fn();
  const unsub = signals['${key}'].subscribe(spy);
  spy.mockClear();
  signals['${key}'].set(${JSON.stringify(nextVal)});
  expect(spy).toHaveBeenCalledWith(${JSON.stringify(nextVal)});
  unsub();
});`.trim(),
      });

      // ── 3. No-notify on same value ──────────────────────────────────
      specs.push({
        type: 'signal',
        name: `signal "${key}" does not notify on same-value set`,
        fn: () => {
          const current = sig.peek();
          const calls: unknown[] = [];
          const unsub = sig.subscribe(() => calls.push(1));
          const before = calls.length; // subscribe fires immediately
          sig.set(current);            // same value — should not fire
          assertEqual(calls.length, before, `${key} should not fire on same-value set`);
          unsub();
        },
        code: `
it('signal "${key}" does not notify on same value', () => {
  const spy = vi.fn();
  const unsub = signals['${key}'].subscribe(spy);
  spy.mockClear();
  signals['${key}'].set(signals['${key}']());
  expect(spy).not.toHaveBeenCalled();
  unsub();
});`.trim(),
      });
    }

    // ── 4. Peek test ──────────────────────────────────────────────────
    specs.push({
      type: 'signal',
      name: `signal "${key}" peek() matches current value`,
      fn: () => {
        assertEqual(sig.peek(), sig(), `${key} peek vs call`);
      },
      code: `
it('signal "${key}" peek matches current value', () => {
  expect(signals['${key}'].peek()).toEqual(signals['${key}']());
});`.trim(),
    });

    // ── 5. Effect re-run test ─────────────────────────────────────────
    if (nextVal !== null) {
      specs.push({
        type: 'signal',
        name: `signal "${key}" triggers effects on change`,
        fn: () => {
          let runCount = 0;
          const dispose = effect(() => {
            sig(); // track
            runCount++;
          });
          const before = runCount;
          sig.set(nextVal);
          assert(runCount > before, `${key} did not trigger an effect`);
          // Restore
          sig.set(initVal);
          dispose();
        },
        code: `
it('signal "${key}" triggers effects', () => {
  const spy = vi.fn(() => { signals['${key}'](); });
  const dispose = effect(spy);
  spy.mockClear();
  signals['${key}'].set(${JSON.stringify(nextVal)});
  expect(spy).toHaveBeenCalledTimes(1);
  dispose();
});`.trim(),
      });
    }
  }

  return specs;
}

// ── generateTestsForComponent ──────────────────────────────────────────

export function generateTestsForComponent(
  componentFn: () => HTMLElement,
  name?: string,
): TestSpec[] {
  const componentName = name ?? componentFn.name ?? 'Component';
  const specs: TestSpec[] = [];

  // ── 1. Renders without throwing ──────────────────────────────────────
  specs.push({
    type: 'unit',
    name: `${componentName} renders without throwing`,
    fn: () => {
      const el = componentFn();
      assert(el instanceof HTMLElement, 'render should return an HTMLElement');
    },
    code: `
it('${componentName} renders without throwing', () => {
  const el = componentFn();
  expect(el).toBeInstanceOf(HTMLElement);
});`.trim(),
  });

  // Render once to introspect
  let el: HTMLElement | null = null;
  try { el = componentFn(); } catch { /* skip introspection */ }

  if (el) {
    const tag = el.tagName.toLowerCase();

    // ── 2. Element type ─────────────────────────────────────────────────
    specs.push({
      type: 'unit',
      name: `${componentName} produces a ${tag} element`,
      fn: () => {
        const rendered = componentFn();
        assertEqual(rendered.tagName.toLowerCase(), tag, 'root element tag');
      },
      code: `
it('${componentName} produces correct root element', () => {
  const el = componentFn();
  expect(el.tagName.toLowerCase()).toBe('${tag}');
});`.trim(),
    });

    // ── 3. Interaction tests ────────────────────────────────────────────
    const buttons = el.querySelectorAll('button:not([disabled])');
    if (buttons.length > 0) {
      specs.push({
        type: 'interaction',
        name: `${componentName} button click does not throw`,
        fn: () => {
          const rendered = componentFn();
          const btn = rendered.querySelector('button') as HTMLButtonElement | null;
          if (btn) btn.click(); // should not throw
        },
        code: `
it('${componentName} button click does not throw', () => {
  const el = componentFn();
  const btn = el.querySelector('button');
  if (btn) expect(() => btn.click()).not.toThrow();
});`.trim(),
      });
    }

    const inputs = el.querySelectorAll('input, textarea, select');
    if (inputs.length > 0) {
      specs.push({
        type: 'interaction',
        name: `${componentName} inputs are present`,
        fn: () => {
          const rendered = componentFn();
          const inp = rendered.querySelector('input, textarea, select');
          assert(inp !== null, 'component should have at least one input');
        },
        code: `
it('${componentName} inputs are present', () => {
  const el = componentFn();
  expect(el.querySelector('input, textarea, select')).not.toBeNull();
});`.trim(),
      });
    }

    // ── 4. Accessibility tests ──────────────────────────────────────────
    specs.push({
      type: 'accessibility',
      name: `${componentName} images have alt attributes`,
      fn: () => {
        const rendered = componentFn();
        rendered.querySelectorAll('img').forEach(img => {
          assert(img.hasAttribute('alt'), `<img> missing alt attribute`);
        });
      },
      code: `
it('${componentName} images have alt', () => {
  const el = componentFn();
  el.querySelectorAll('img').forEach(img => {
    expect(img.hasAttribute('alt')).toBe(true);
  });
});`.trim(),
    });

    specs.push({
      type: 'accessibility',
      name: `${componentName} buttons are keyboard reachable`,
      fn: () => {
        const rendered = componentFn();
        rendered.querySelectorAll('button').forEach(btn => {
          assert(
            (btn as HTMLButtonElement).tabIndex !== -1,
            `button should not have tabIndex -1`,
          );
        });
      },
      code: `
it('${componentName} buttons are keyboard reachable', () => {
  const el = componentFn();
  el.querySelectorAll('button').forEach(btn => {
    expect(btn.tabIndex).not.toBe(-1);
  });
});`.trim(),
    });

    specs.push({
      type: 'accessibility',
      name: `${componentName} inputs have labels`,
      fn: () => {
        const rendered = componentFn();
        rendered.querySelectorAll('input:not([type="hidden"])').forEach(input => {
          const id = input.id;
          const hasLabel = id
            ? rendered.querySelector(`label[for="${id}"]`) !== null
            : false;
          const hasAria =
            input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
          assert(hasLabel || hasAria, `input missing label or aria-label`);
        });
      },
      code: `
it('${componentName} inputs have labels', () => {
  const el = componentFn();
  el.querySelectorAll('input:not([type="hidden"])').forEach(input => {
    const id = input.id;
    const hasLabel = id ? el.querySelector('label[for="' + id + '"]') !== null : false;
    const hasAria = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    expect(hasLabel || hasAria).toBe(true);
  });
});`.trim(),
    });
  }

  return specs;
}
