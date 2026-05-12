import { signal, effect } from './signal.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface AITraceEntry {
  id: string;
  timestamp: number;
  actor: 'human' | 'ai' | 'system';
  agentId?: string;
  action: 'read' | 'write' | 'generate' | 'heal' | 'query';
  target: string;        // signal label or component name
  before?: unknown;
  after?: unknown;
  reason?: string;
  confidence?: number;
  approved?: boolean;
}

export interface AITrace {
  entries: () => AITraceEntry[];
  record: (entry: Omit<AITraceEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
  export: () => string;           // JSON export
  filter: (pred: (e: AITraceEntry) => boolean) => AITraceEntry[];
  subscribe: (fn: (entry: AITraceEntry) => void) => () => void;
}

export interface AITraceOptions {
  maxEntries?: number;
  persist?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────

let _idCounter = 0;

function generateId(): string {
  _idCounter++;
  const rand = Math.random().toString(36).slice(2, 8);
  return `trace_${_idCounter}_${rand}`;
}

const PERSIST_KEY = '__drishti_aitrace__';

function loadPersisted(): AITraceEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AITraceEntry[];
  } catch {
    return [];
  }
}

function savePersisted(entries: AITraceEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded — fail silently
  }
}

// ── createAITrace ──────────────────────────────────────────────────────

export function createAITrace(opts?: AITraceOptions): AITrace {
  const maxEntries = opts?.maxEntries ?? 1000;
  const persist = opts?.persist ?? false;

  const _entriesSig = signal<AITraceEntry[]>(persist ? loadPersisted() : []);
  const _subscribers = new Set<(entry: AITraceEntry) => void>();

  // Persist to localStorage whenever entries change
  if (persist) {
    effect(() => {
      savePersisted(_entriesSig());
    });
  }

  const trace: AITrace = {
    entries(): AITraceEntry[] {
      return _entriesSig();
    },

    record(entry: Omit<AITraceEntry, 'id' | 'timestamp'>): void {
      const full: AITraceEntry = {
        ...entry,
        id: generateId(),
        timestamp: Date.now(),
      };

      const current = _entriesSig.peek();
      const next =
        current.length >= maxEntries
          ? [...current.slice(current.length - maxEntries + 1), full]
          : [...current, full];

      _entriesSig.set(next);

      // Notify subscribers
      for (const fn of _subscribers) {
        try {
          fn(full);
        } catch {
          // subscriber errors are swallowed
        }
      }
    },

    clear(): void {
      _entriesSig.set([]);
      if (persist && typeof localStorage !== 'undefined') {
        localStorage.removeItem(PERSIST_KEY);
      }
    },

    export(): string {
      return JSON.stringify(_entriesSig.peek(), null, 2);
    },

    filter(pred: (e: AITraceEntry) => boolean): AITraceEntry[] {
      return _entriesSig.peek().filter(pred);
    },

    subscribe(fn: (entry: AITraceEntry) => void): () => void {
      _subscribers.add(fn);
      return () => _subscribers.delete(fn);
    },
  };

  return trace;
}

// ── globalTrace ────────────────────────────────────────────────────────

export const globalTrace: AITrace = createAITrace({ maxEntries: 5000 });
