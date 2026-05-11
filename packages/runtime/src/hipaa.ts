import { signal } from './signal.js';
import type { Signal } from './types.js';

export interface HIPAAOptions {
  scrubPatterns?: RegExp[];
  onViolation?:  (field: string, value: unknown) => void;
}

export interface HIPAAHandle {
  isEnabled():          boolean;
  scrub(value: string): string;
  wrapSignal<T>(sig: Signal<T>, label: string): Signal<T>;
  disable(): void;
}

// Module-level HIPAA state
let _hipaaEnabled = false;

const BUILTIN_PATTERNS: Array<[RegExp, string]> = [
  [/\b\d{3}-\d{2}-\d{4}\b/g,                                                '[SSN REDACTED]'],
  [/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi,                                       '[EMAIL REDACTED]'],
  [/\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,                 '[PHONE REDACTED]'],
  [/\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,                              '[CARD REDACTED]'],
  [/\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}\b/g,                   '[DOB REDACTED]'],
];

export function enableHIPAA(opts?: HIPAAOptions): HIPAAHandle {
  _hipaaEnabled = true;

  const extraPatterns: Array<[RegExp, string]> = (opts?.scrubPatterns ?? []).map(
    re => [re, '[REDACTED]'],
  );

  function scrub(value: string): string {
    let result = value;
    for (const [pattern, replacement] of BUILTIN_PATTERNS) {
      // Reset lastIndex since we're reusing regexes across calls
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }
    for (const [pattern, replacement] of extraPatterns) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  function wrapSignal<T>(sig: Signal<T>, label: string): Signal<T> {
    const handler: ProxyHandler<Signal<T>> = {
      apply(target, thisArg, args) {
        if (_hipaaEnabled) {
          opts?.onViolation?.(label, sig.peek());
          console.log(`[HIPAA] read access on signal "${label}"`);
        }
        return Reflect.apply(target as (...a: unknown[]) => unknown, thisArg, args);
      },
      get(target, prop, receiver) {
        const val = Reflect.get(target, prop, receiver) as unknown;
        if (prop === 'peek') {
          return function (...args: unknown[]) {
            if (_hipaaEnabled) {
              opts?.onViolation?.(label, sig.peek());
              console.log(`[HIPAA] peek access on signal "${label}"`);
            }
            return (val as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        if (prop === 'set') {
          return function (next: T) {
            if (_hipaaEnabled) {
              opts?.onViolation?.(label, next);
              console.log(`[HIPAA] write access on signal "${label}"`);
            }
            return (val as (v: T) => void).call(target, next);
          };
        }
        return val;
      },
    };

    return new Proxy(sig, handler);
  }

  return {
    isEnabled(): boolean {
      return _hipaaEnabled;
    },

    scrub,

    wrapSignal,

    disable(): void {
      _hipaaEnabled = false;
    },
  };
}
