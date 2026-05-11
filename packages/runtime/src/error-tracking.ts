import { signal } from './signal.js';
import { _getDevSignals } from './signal.js';
import type { Signal } from './types.js';

export interface TrackedError {
  id:           string;
  message:      string;
  stack?:       string;
  timestamp:    number;
  url:          string;
  signalState?: Record<string, unknown>;
  userId?:      string;
  sessionId:    string;
  tags:         Record<string, string>;
}

export interface ErrorTrackingOptions {
  endpoint?:       string;
  maxErrors?:      number;
  captureSignals?: boolean;
  userId?:         string | Signal<string>;
  tags?:           Record<string, string>;
  beforeSend?:     (err: TrackedError) => TrackedError | null;
  onError?:        (err: TrackedError) => void;
  ignorePatterns?: RegExp[];
}

export interface ErrorTrackingHandle {
  readonly errors: readonly TrackedError[];
  capture(err: Error | string, extra?: Record<string, unknown>): void;
  setUser(userId: string): void;
  setTag(key: string, value: string): void;
  flush(): Promise<void>;
  destroy(): void;
}

function generateId(): string {
  return Math.random().toString(16).slice(2, 18);
}

export function createErrorTracker(opts?: ErrorTrackingOptions): ErrorTrackingHandle {
  const sessionId  = generateId();
  const maxErrors  = opts?.maxErrors ?? 100;
  const errors: TrackedError[] = [];
  const tags: Record<string, string> = { ...(opts?.tags ?? {}) };
  let currentUserId: string | undefined =
    typeof opts?.userId === 'string' ? opts.userId : undefined;

  function getUrl(): string {
    return typeof window !== 'undefined' && window.location
      ? window.location.href
      : '';
  }

  function capture(err: Error | string, extra?: Record<string, unknown>): void {
    const message = typeof err === 'string' ? err : err.message;
    const stack   = typeof err === 'string' ? undefined : err.stack;

    // Check ignore patterns
    if (opts?.ignorePatterns) {
      for (const pat of opts.ignorePatterns) {
        if (pat.test(message)) return;
      }
    }

    let signalState: Record<string, unknown> | undefined;
    if (opts?.captureSignals) {
      signalState = {};
      for (const entry of _getDevSignals()) {
        signalState[entry.label] = entry.peek();
      }
    }

    // Resolve userId from Signal if needed
    const resolvedUserId: string | undefined =
      opts?.userId && typeof opts.userId !== 'string'
        ? (opts.userId as Signal<string>)()
        : currentUserId;

    const tracked: TrackedError = {
      id:        generateId(),
      message,
      timestamp: Date.now(),
      url:       getUrl(),
      sessionId,
      tags:      { ...tags },
      ...(stack !== undefined ? { stack } : {}),
      ...(signalState !== undefined ? { signalState } : {}),
      ...(resolvedUserId !== undefined ? { userId: resolvedUserId } : {}),
      ...((extra && Object.keys(extra).length > 0) ? {} : {}),
    };

    const finalError = opts?.beforeSend ? opts.beforeSend(tracked) : tracked;
    if (finalError === null) return;

    // ring buffer
    if (errors.length >= maxErrors) {
      errors.shift();
    }
    errors.push(finalError);
    opts?.onError?.(finalError);
  }

  // Browser error listeners
  let errorListener: ((ev: ErrorEvent) => void) | undefined;
  let rejectionListener: ((ev: PromiseRejectionEvent) => void) | undefined;

  if (typeof window !== 'undefined') {
    errorListener = (ev: ErrorEvent) => {
      capture(ev.error instanceof Error ? ev.error : new Error(ev.message));
    };
    rejectionListener = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      capture(reason instanceof Error ? reason : new Error(String(reason)));
    };
    window.addEventListener('error', errorListener);
    window.addEventListener('unhandledrejection', rejectionListener);
  }

  return {
    get errors(): readonly TrackedError[] {
      return errors;
    },

    capture,

    setUser(userId: string): void {
      currentUserId = userId;
    },

    setTag(key: string, value: string): void {
      tags[key] = value;
    },

    async flush(): Promise<void> {
      if (!opts?.endpoint || errors.length === 0) return;
      try {
        await fetch(opts.endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(errors),
        });
      } catch {
        // best-effort
      }
    },

    destroy(): void {
      if (typeof window !== 'undefined') {
        if (errorListener)     window.removeEventListener('error', errorListener);
        if (rejectionListener) window.removeEventListener('unhandledrejection', rejectionListener);
      }
    },
  };
}
