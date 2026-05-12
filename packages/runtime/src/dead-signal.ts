import { signal } from './signal.js';

export interface DeadSignalOptions {
  checkIntervalMs?: number;  // how often to scan. Default: 30_000 (30s)
  gracePeriodMs?: number;    // ignore signals younger than this. Default: 5_000
  onDead?: (label: string, age: number) => void;
  devOnly?: boolean;         // if true, no-op in production. Default: true
}

export interface DeadSignalReport {
  label: string;
  createdAt: number;
  ageMs: number;
  lastAccessMs: number | null;
}

export interface DeadSignalDetector {
  register: (label: string) => { onRead: () => void; onWrite: () => void };
  scan: () => DeadSignalReport[];
  stop: () => void;
}

function isDevEnvironment(): boolean {
  // Check Vite-style import.meta.env
  try {
    const metaEnv = (import.meta as Record<string, unknown>).env as Record<string, unknown> | undefined;
    if (metaEnv !== undefined) {
      // If DEV is explicitly false, we're in production
      if (metaEnv['DEV'] === false) return false;
      // If DEV is explicitly true, we're in dev
      if (metaEnv['DEV'] === true) return true;
      // If PROD is explicitly true, we're in production
      if (metaEnv['PROD'] === true) return false;
    }
  } catch {
    // import.meta.env not available
  }

  // Check Node.js process.env
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env['NODE_ENV'] === 'production') return false;
    }
  } catch {
    // process not available
  }

  // Default to dev
  return true;
}

interface SignalEntry {
  createdAt: number;
  lastRead: number | null;
  lastWrite: number | null;
}

export function createDeadSignalDetector(opts?: DeadSignalOptions): DeadSignalDetector {
  const checkIntervalMs = opts?.checkIntervalMs ?? 30_000;
  const gracePeriodMs = opts?.gracePeriodMs ?? 5_000;
  const devOnly = opts?.devOnly ?? true;

  // If devOnly and we're in production, return a no-op detector
  if (devOnly && !isDevEnvironment()) {
    return {
      register: (_label: string) => ({ onRead: () => {}, onWrite: () => {} }),
      scan: () => [],
      stop: () => {},
    };
  }

  const entries = new Map<string, SignalEntry>();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const scan = (): DeadSignalReport[] => {
    const now = Date.now();
    const dead: DeadSignalReport[] = [];

    for (const [label, entry] of entries) {
      const age = now - entry.createdAt;
      if (age < gracePeriodMs) continue;
      if (entry.lastRead !== null || entry.lastWrite !== null) continue;

      const lastAccessMs = entry.lastRead !== null
        ? entry.lastRead
        : entry.lastWrite !== null
        ? entry.lastWrite
        : null;

      dead.push({ label, createdAt: entry.createdAt, ageMs: age, lastAccessMs });
    }

    return dead;
  };

  const startInterval = () => {
    if (intervalId !== null) return;
    intervalId = setInterval(() => {
      if (!opts?.onDead) return;
      const dead = scan();
      for (const report of dead) {
        opts.onDead(report.label, report.ageMs);
      }
    }, checkIntervalMs);

    // Allow process to exit in Node.js even if interval is active
    if (typeof intervalId === 'object' && intervalId !== null && 'unref' in intervalId) {
      (intervalId as { unref(): void }).unref();
    }
  };

  startInterval();

  return {
    register: (label: string) => {
      entries.set(label, { createdAt: Date.now(), lastRead: null, lastWrite: null });

      return {
        onRead: () => {
          const entry = entries.get(label);
          if (entry) entry.lastRead = Date.now();
        },
        onWrite: () => {
          const entry = entries.get(label);
          if (entry) entry.lastWrite = Date.now();
        },
      };
    },

    scan,

    stop: () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}

export function watchedSignal<T>(
  initial: T,
  label: string,
  detector: DeadSignalDetector,
): ReturnType<typeof signal<T>> {
  const hooks = detector.register(label);
  const inner = signal<T>(initial);

  // Wrap the signal to intercept reads and writes
  const wrapped = Object.assign(
    function (): T {
      hooks.onRead();
      return inner();
    },
    {
      peek: (): T => {
        hooks.onRead();
        return inner.peek();
      },
      set: (v: T): void => {
        hooks.onWrite();
        inner.set(v);
      },
      subscribe: inner.subscribe.bind(inner),
    },
  ) as ReturnType<typeof signal<T>>;

  return wrapped;
}
