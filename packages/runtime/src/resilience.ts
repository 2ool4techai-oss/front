import { signal, computed } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type ResilienceState = 'healthy' | 'degraded' | 'open' | 'half-open' | 'recovering';

export interface RetryPolicy {
  maxAttempts: number;
  backoff:     'fixed' | 'exponential' | 'linear';
  delayMs:     number;
  maxDelayMs?: number;
  jitter?:     boolean;
}

export interface BulkheadOptions {
  /** Max concurrent requests. Default: 10 */
  maxConcurrent: number;
  /** Max queue size (requests waiting). Default: 20 */
  maxQueue?:     number;
}

export interface CircuitOptions<T> {
  /** Fallback value/function when circuit is open */
  fallback:          T | (() => T) | (() => Promise<T>);
  /** Failure threshold before opening. Default: 5 */
  failureThreshold?: number;
  /** Reset timeout in ms. Default: 30_000 */
  halfOpenAfter?:    string | number;
  /** Probe count in half-open state. Default: 1 */
  halfOpenProbes?:   number;
  /** Retry policy for failed calls */
  retry?:            RetryPolicy;
  /** Concurrency bulkhead */
  bulkhead?:         BulkheadOptions;
  /** Called on state transitions */
  onStateChange?:    (next: ResilienceState, prev: ResilienceState) => void;
  /** Timeout for individual calls in ms. Default: none */
  timeoutMs?:        number;
}

export interface CircuitHandle<T> {
  /** Current state of the circuit */
  readonly state:    Signal<ResilienceState>;
  /** How many failures counted */
  readonly failures: Signal<number>;
  /** Is circuit allowing calls through? */
  readonly isOpen:   ComputedSignal<boolean>;
  /** Execute a call through the circuit */
  call(fn: () => Promise<T>): Promise<T>;
  /** Manually reset the circuit to healthy */
  reset():           void;
  /** Manually trip the circuit open */
  trip():            void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function parseHalfOpenAfter(val: string | number | undefined): number {
  if (val === undefined) return 30_000;
  if (typeof val === 'number') return val;
  const minMatch = val.match(/^(\d+(?:\.\d+)?)m$/);
  if (minMatch) return parseFloat(minMatch[1]!) * 60_000;
  const secMatch = val.match(/^(\d+(?:\.\d+)?)s$/);
  if (secMatch) return parseFloat(secMatch[1]!) * 1_000;
  return parseInt(val, 10);
}

function calcBackoff(policy: RetryPolicy, attempt: number): number {
  let delay: number;
  switch (policy.backoff) {
    case 'exponential':
      delay = policy.delayMs * Math.pow(2, attempt - 1);
      break;
    case 'linear':
      delay = policy.delayMs * attempt;
      break;
    default:
      delay = policy.delayMs;
  }
  if (policy.maxDelayMs !== undefined) delay = Math.min(delay, policy.maxDelayMs);
  if (policy.jitter) delay = delay * (0.5 + Math.random() * 0.5);
  return delay;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── timeout ───────────────────────────────────────────────────────────────

export async function timeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[DRISHTI] Timed out after ${ms}ms`)), ms);
    fn().then(
      v  => { clearTimeout(timer); resolve(v); },
      e  => { clearTimeout(timer); reject(e); },
    );
  });
}

// ── retry ─────────────────────────────────────────────────────────────────

export async function retry<T>(fn: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < policy.maxAttempts) {
        await sleep(calcBackoff(policy, attempt));
      }
    }
  }
  throw lastErr;
}

// ── withFallback ──────────────────────────────────────────────────────────

export async function withFallback<T>(
  fn:       () => Promise<T>,
  fallback: T | (() => T),
  opts?:    { timeoutMs?: number },
): Promise<T> {
  try {
    const wrapped = opts?.timeoutMs !== undefined ? () => timeout(fn, opts.timeoutMs!) : fn;
    return await wrapped();
  } catch {
    if (typeof fallback === 'function') return (fallback as () => T)();
    return fallback;
  }
}

// ── circuit ───────────────────────────────────────────────────────────────

export function circuit<T>(opts: CircuitOptions<T>): CircuitHandle<T> {
  const failureThreshold = opts.failureThreshold ?? 5;
  const halfOpenAfterMs  = parseHalfOpenAfter(opts.halfOpenAfter);
  const halfOpenProbes   = opts.halfOpenProbes ?? 1;

  const stateSig    = signal<ResilienceState>('healthy');
  const failuresSig = signal<number>(0);
  const isOpenSig   = computed<boolean>(() => stateSig() === 'open');

  let resetTimer:      ReturnType<typeof setTimeout> | null = null;
  let probeSuccesses   = 0;
  let probeAttempts    = 0;

  // Bulkhead tracking
  let concurrent = 0;
  let queued     = 0;

  function transition(next: ResilienceState): void {
    const prev = stateSig.peek();
    if (prev === next) return;
    stateSig.set(next);
    opts.onStateChange?.(next, prev);
  }

  function startResetTimer(): void {
    if (resetTimer !== null) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetTimer = null;
      probeSuccesses = 0;
      probeAttempts  = 0;
      transition('half-open');
    }, halfOpenAfterMs);
  }

  async function resolveFallback(): Promise<T> {
    const fb = opts.fallback;
    if (typeof fb === 'function') return (fb as () => T | Promise<T>)();
    return fb;
  }

  async function executeCall(fn: () => Promise<T>): Promise<T> {
    if (opts.timeoutMs !== undefined) {
      return timeout(fn, opts.timeoutMs);
    }
    return fn();
  }

  async function callInternal(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await executeCall(fn);
      // success
      const cur = stateSig.peek();
      if (cur === 'half-open') {
        probeSuccesses++;
        if (probeSuccesses >= halfOpenProbes) {
          failuresSig.set(0);
          transition('healthy');
        }
      } else {
        // Decrement failures towards 0
        const f = failuresSig.peek();
        if (f > 0) failuresSig.set(f - 1);
      }
      return result;
    } catch (e) {
      // failure
      const cur = stateSig.peek();
      if (cur === 'half-open') {
        // any probe failure → re-open
        transition('open');
        startResetTimer();
        throw e;
      }
      const newFailures = failuresSig.peek() + 1;
      failuresSig.set(newFailures);
      if (newFailures >= failureThreshold) {
        transition('open');
        startResetTimer();
      }
      throw e;
    }
  }

  async function callWithRetry(fn: () => Promise<T>): Promise<T> {
    if (!opts.retry) return callInternal(fn);

    const policy = opts.retry;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        return await callInternal(fn);
      } catch (e) {
        lastErr = e;
        // If circuit just opened, stop retrying
        if (stateSig.peek() === 'open') throw e;
        if (attempt < policy.maxAttempts) {
          if (attempt === 1) transition('degraded');
          await sleep(calcBackoff(policy, attempt));
        }
      }
    }
    throw lastErr;
  }

  return {
    state:    stateSig,
    failures: failuresSig,
    isOpen:   isOpenSig,

    async call(fn: () => Promise<T>): Promise<T> {
      const cur = stateSig.peek();

      // Circuit is open — return fallback
      if (cur === 'open') {
        return resolveFallback();
      }

      // Half-open — allow limited probes
      if (cur === 'half-open') {
        probeAttempts++;
        if (probeAttempts > halfOpenProbes) {
          return resolveFallback();
        }
      }

      // Bulkhead check
      if (opts.bulkhead) {
        const maxConcurrent = opts.bulkhead.maxConcurrent;
        const maxQueue      = opts.bulkhead.maxQueue ?? 20;
        if (concurrent >= maxConcurrent) {
          if (queued >= maxQueue) {
            throw new Error('[DRISHTI] Bulkhead: concurrency + queue limit exceeded');
          }
          // Queue the request
          queued++;
          await new Promise<void>((resolve, reject) => {
            const check = (): void => {
              if (concurrent < maxConcurrent) {
                queued--;
                resolve();
              } else {
                setTimeout(check, 5);
              }
            };
            void check();
            void reject; // keep ref
          });
        }
        concurrent++;
        try {
          return await callWithRetry(fn);
        } finally {
          concurrent--;
        }
      }

      return callWithRetry(fn);
    },

    reset(): void {
      if (resetTimer !== null) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
      failuresSig.set(0);
      probeSuccesses = 0;
      probeAttempts  = 0;
      concurrent     = 0;
      queued         = 0;
      transition('healthy');
    },

    trip(): void {
      transition('open');
      startResetTimer();
    },
  };
}
