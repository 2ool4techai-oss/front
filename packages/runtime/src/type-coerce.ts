import { signal } from './signal.js';

export type CoerceTarget = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface CoerceOptions<T> {
  target: CoerceTarget;
  strict?: boolean;        // if true, throw on bad coercion instead of warn. Default: false
  onCoerce?: (from: unknown, to: T, method: string) => void;
  fallback?: T;            // value to use when coercion is impossible
}

export interface CoercedSignal<T> {
  (): T;
  set: (v: unknown) => void; // accepts any type, coerces to T
  peek: () => T;
  lastCoercion: () => { from: unknown; to: T; method: string } | null;
  coercionCount: () => number;
}

function coerce<T>(
  v: unknown,
  opts: CoerceOptions<T>,
): { value: T; method: string; wasCoerced: boolean } {
  const target = opts.target;

  if (target === 'string') {
    if (v === null || v === undefined) {
      if (opts.fallback !== undefined) {
        return { value: opts.fallback, method: 'fallback', wasCoerced: true };
      }
      const result = '' as unknown as T;
      return { value: result, method: 'null-to-empty-string', wasCoerced: true };
    }
    if (typeof v === 'string') {
      return { value: v as unknown as T, method: 'identity', wasCoerced: false };
    }
    const result = String(v) as unknown as T;
    return { value: result, method: 'String()', wasCoerced: true };
  }

  if (target === 'number') {
    if (typeof v === 'number' && !isNaN(v)) {
      return { value: v as unknown as T, method: 'identity', wasCoerced: false };
    }
    const coerced = Number(v);
    if (isNaN(coerced)) {
      const fallback = (opts.fallback !== undefined ? opts.fallback : 0) as T;
      return { value: fallback, method: 'fallback', wasCoerced: true };
    }
    return { value: coerced as unknown as T, method: 'Number()', wasCoerced: true };
  }

  if (target === 'boolean') {
    if (typeof v === 'boolean') {
      return { value: v as unknown as T, method: 'identity', wasCoerced: false };
    }
    if (v === 'true') {
      return { value: true as unknown as T, method: 'string-parse', wasCoerced: true };
    }
    if (v === 'false') {
      return { value: false as unknown as T, method: 'string-parse', wasCoerced: true };
    }
    const result = Boolean(v) as unknown as T;
    return { value: result, method: 'Boolean()', wasCoerced: true };
  }

  if (target === 'array') {
    if (Array.isArray(v)) {
      return { value: v as unknown as T, method: 'identity', wasCoerced: false };
    }
    const result = [v] as unknown as T;
    return { value: result, method: 'wrap-in-array', wasCoerced: true };
  }

  if (target === 'object') {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return { value: v as unknown as T, method: 'identity', wasCoerced: false };
    }
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { value: parsed as T, method: 'JSON.parse()', wasCoerced: true };
        }
      } catch {
        // fall through to fallback
      }
    }
    if (opts.fallback !== undefined) {
      return { value: opts.fallback, method: 'fallback', wasCoerced: true };
    }
    return { value: {} as unknown as T, method: 'empty-object', wasCoerced: true };
  }

  // Should never reach here given TypeScript types
  return { value: v as T, method: 'identity', wasCoerced: false };
}

export function coercedSignal<T>(initial: T, opts: CoerceOptions<T>): CoercedSignal<T> {
  const inner = signal<T>(initial);
  let _lastCoercion: { from: unknown; to: T; method: string } | null = null;
  let _coercionCount = 0;

  function applySet(v: unknown): void {
    const { value, method, wasCoerced } = coerce<T>(v, opts);

    if (wasCoerced) {
      if (opts.strict) {
        throw new TypeError(
          `[DRISHTI] coercedSignal: strict mode — cannot coerce ${JSON.stringify(v)} to ${opts.target} via ${method}`,
        );
      }
      console.warn(
        `[DRISHTI] coercedSignal: coerced value from`,
        v,
        `to`,
        value,
        `via ${method}`,
      );
      _lastCoercion = { from: v, to: value, method };
      _coercionCount++;
      opts.onCoerce?.(v, value, method);
    }

    inner.set(value);
  }

  const sig = Object.assign(
    function (): T {
      return inner();
    },
    {
      set: applySet,
      peek: (): T => inner.peek(),
      lastCoercion: () => _lastCoercion,
      coercionCount: () => _coercionCount,
    },
  ) as CoercedSignal<T>;

  return sig;
}
