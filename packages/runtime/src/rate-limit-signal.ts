/**
 * rate-limit-signal.ts
 * Prevent signals from being written more than N times per time window.
 * Security: bot detection, abuse prevention.
 */

import { signal } from './signal.js';

export interface RateLimitOptions {
  maxWrites: number;
  windowMs: number;
  onViolation?: (count: number, windowMs: number) => void;
  mode?: 'throw' | 'drop' | 'queue';
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface RateLimitedSignal<T> {
  (): T;
  set: (v: T) => void;
  force: (v: T) => void;
  peek: () => T;
  writeCount: () => number;
  isLimited: () => boolean;
  reset: () => void;
}

export function rateLimitSignal<T>(initial: T, opts: RateLimitOptions): RateLimitedSignal<T> {
  const inner = signal<T>(initial);
  const mode = opts.mode ?? 'drop';

  // Circular buffer approach: store timestamps of recent writes
  const timestamps: number[] = [];
  const _queue: T[] = [];
  let _queueTimer: ReturnType<typeof setTimeout> | null = null;

  function pruneTimestamps(now: number): void {
    const cutoff = now - opts.windowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  function countInWindow(): number {
    const now = Date.now();
    pruneTimestamps(now);
    return timestamps.length;
  }

  function isLimitedNow(): boolean {
    return countInWindow() >= opts.maxWrites;
  }

  function doWrite(v: T): void {
    const now = Date.now();
    pruneTimestamps(now);
    timestamps.push(now);
    inner.set(v);
  }

  function scheduleQueue(v: T): void {
    _queue.push(v);
    if (_queueTimer === null) {
      // Schedule the flush after the window expires
      const now = Date.now();
      pruneTimestamps(now);
      // How long until the oldest timestamp in window expires?
      const oldestInWindow = timestamps[0];
      const delay = oldestInWindow !== undefined
        ? oldestInWindow + opts.windowMs - now + 1
        : opts.windowMs;

      _queueTimer = setTimeout(() => {
        _queueTimer = null;
        // Drain the queue up to the available capacity
        while (_queue.length > 0 && !isLimitedNow()) {
          const next = _queue.shift()!;
          doWrite(next);
        }
        // If there are still items queued, re-schedule
        if (_queue.length > 0) {
          scheduleQueue(_queue.shift()!);
        }
      }, Math.max(delay, 0));
    }
  }

  const sig = Object.assign(
    function (): T {
      return inner();
    },
    {
      set(v: T): void {
        if (isLimitedNow()) {
          const count = countInWindow();
          opts.onViolation?.(count, opts.windowMs);
          if (mode === 'throw') {
            throw new RateLimitError(
              `[DRISHTI] Rate limit exceeded: ${count} writes in ${opts.windowMs}ms window`,
            );
          } else if (mode === 'queue') {
            scheduleQueue(v);
          }
          // 'drop' mode: silently ignore
          return;
        }
        doWrite(v);
      },

      force(v: T): void {
        // Bypasses rate limit entirely — no timestamp recording for quota
        inner.set(v);
      },

      peek(): T {
        return inner.peek();
      },

      writeCount(): number {
        return countInWindow();
      },

      isLimited(): boolean {
        return isLimitedNow();
      },

      reset(): void {
        timestamps.length = 0;
        _queue.length = 0;
        if (_queueTimer !== null) {
          clearTimeout(_queueTimer);
          _queueTimer = null;
        }
      },
    },
  ) as RateLimitedSignal<T>;

  return sig;
}
