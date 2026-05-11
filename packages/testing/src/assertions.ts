import type { Signal } from '@drishti/runtime';

// ── expectSignal ───────────────────────────────────────────────────────

export function expectSignal<T>(sig: Signal<T>): {
  toHaveValue(expected: T): void;
  toHaveChangedTo(expected: T): void;
  not: { toHaveValue(expected: T): void };
} {
  return {
    toHaveValue(expected: T): void {
      const actual = sig();
      if (actual !== expected) {
        throw new Error(
          `expectSignal.toHaveValue: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    },

    toHaveChangedTo(expected: T): void {
      const actual = sig();
      if (actual !== expected) {
        throw new Error(
          `expectSignal.toHaveChangedTo: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    },

    not: {
      toHaveValue(expected: T): void {
        const actual = sig();
        if (actual === expected) {
          throw new Error(
            `expectSignal.not.toHaveValue: expected signal NOT to have value ${JSON.stringify(expected)}, but it did`,
          );
        }
      },
    },
  };
}

// ── setupSignalMatchers ────────────────────────────────────────────────

export function setupSignalMatchers(): void {
  const globalExpect = (globalThis as Record<string, unknown>)['expect'] as
    | ({ extend: (matchers: Record<string, unknown>) => void } & Record<string, unknown>)
    | undefined;

  if (globalExpect == null || !('extend' in globalExpect)) return;

  globalExpect.extend({
    toHaveSignalValue<T>(received: Signal<T>, expected: T) {
      const actual = received();
      const pass = actual === expected;
      return {
        pass,
        message: () =>
          pass
            ? `expected signal NOT to have value ${JSON.stringify(expected)}`
            : `expected signal to have value ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      };
    },

    toHaveValue<T>(received: Signal<T>, expected: T) {
      // Signal-aware toHaveValue: if received is callable (signal), read it
      if (typeof received === 'function') {
        const actual = (received as () => T)();
        const pass = actual === expected;
        return {
          pass,
          message: () =>
            pass
              ? `expected signal NOT to have value ${JSON.stringify(expected)}`
              : `expected signal to have value ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        };
      }
      // Fall through to default behaviour
      const pass = received === expected;
      return {
        pass,
        message: () =>
          pass
            ? `expected ${JSON.stringify(received)} NOT to equal ${JSON.stringify(expected)}`
            : `expected ${JSON.stringify(received)} to equal ${JSON.stringify(expected)}`,
      };
    },
  });
}
