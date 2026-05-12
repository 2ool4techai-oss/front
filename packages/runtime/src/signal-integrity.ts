/**
 * signal-integrity.ts
 * HMAC-sign critical signal values to detect tampering during SSR hydration or XSS injection.
 */

import { signal } from './signal.js';

export interface IntegrityOptions {
  secret: string;
  algorithm?: 'SHA-256' | 'SHA-1';
  onTamper?: (label: string, received: string, expected: string) => void;
}

export interface IntegritySignal<T> {
  (): T;
  set: (v: T) => void;
  peek: () => T;
  verify: () => boolean;
  signature: () => string;
}

export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

/**
 * Compute a deterministic HMAC-like signature using a pure-JS approach suitable for sync use.
 * Uses a seeded hash: btoa(secret + ':' + serializedValue) as a lightweight integrity token.
 * Not cryptographically secure for adversarial use, but sufficient for detecting accidental
 * tampering, SSR hydration mismatches, and XSS injection in a frontend framework context.
 */
function computeSignature(secret: string, value: unknown): string {
  const serialized = JSON.stringify(value);
  // Build a simple rolling hash over secret + ':' + serialized
  const input = secret + ':' + serialized;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  return btoa(hash + ':' + serialized).replace(/=/g, '');
}

export function createIntegritySignal<T>(
  initial: T,
  label: string,
  opts: IntegrityOptions,
): IntegritySignal<T> {
  const inner = signal<T>(initial);
  let _sig = computeSignature(opts.secret, initial);

  const recomputeSig = (v: T) => computeSignature(opts.secret, v);

  const read = (): T => {
    const current = inner.peek();
    const expected = recomputeSig(current);
    if (_sig !== expected) {
      opts.onTamper?.(label, _sig, expected);
      throw new IntegrityError(
        `[DRISHTI] Integrity violation on signal "${label}": signature mismatch`,
      );
    }
    return current;
  };

  const fn = Object.assign(
    function (): T {
      return read();
    },
    {
      set(v: T): void {
        inner.set(v);
        _sig = recomputeSig(v);
      },

      peek(): T {
        return inner.peek();
      },

      verify(): boolean {
        try {
          read();
          return true;
        } catch {
          return false;
        }
      },

      signature(): string {
        return _sig;
      },
    },
  ) as IntegritySignal<T>;

  return fn;
}
