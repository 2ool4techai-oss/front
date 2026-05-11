import { _setSignalWriteHook } from './signal.js';
import type { Signal } from './types.js';

export interface AuditEntry {
  signalLabel: string;
  userId?:     string;
  action:      'read' | 'write';
  prevValue?:  unknown;
  nextValue?:  unknown;
  timestamp:   number;
  sessionId:   string;
}

export interface AuditOptions {
  userId?:     string | Signal<string>;
  maxEntries?: number;
  onEntry?:    (entry: AuditEntry) => void;
  include?:    string[];
  exclude?:    string[];
  actions?:    ('read' | 'write')[];
}

export interface AuditHandle {
  readonly log:  readonly AuditEntry[];
  readonly size: number;
  export():      string;
  clear():       void;
  getBySignal(label: string): AuditEntry[];
  getByUser(userId: string): AuditEntry[];
  stop(): void;
}

export function createAuditLog(opts?: AuditOptions): AuditHandle {
  const maxEntries = opts?.maxEntries ?? 500;
  const actions    = opts?.actions    ?? ['write'];
  const include    = opts?.include    ?? [];
  const exclude    = opts?.exclude    ?? [];
  const sessionId  = Math.random().toString(36).slice(2, 10);

  const _log: AuditEntry[] = [];

  function getUserId(): string | undefined {
    if (!opts?.userId) return undefined;
    if (typeof opts.userId === 'string') return opts.userId;
    // It's a Signal<string>
    return (opts.userId as Signal<string>)();
  }

  _setSignalWriteHook((sig, label, prev, next) => {
    if (!actions.includes('write')) return;
    if (include.length > 0 && !include.includes(label)) return;
    if (exclude.length > 0 && exclude.includes(label)) return;

    const userId = getUserId();
    const entry: AuditEntry = {
      signalLabel: label,
      action:      'write',
      prevValue:   prev,
      nextValue:   next,
      timestamp:   Date.now(),
      sessionId,
    };
    if (userId !== undefined) {
      entry.userId = userId;
    }

    _log.push(entry);
    if (_log.length > maxEntries) {
      _log.splice(0, _log.length - maxEntries);
    }

    opts?.onEntry?.(entry);
  });

  return {
    get log(): readonly AuditEntry[] {
      return _log;
    },

    get size(): number {
      return _log.length;
    },

    export(): string {
      return JSON.stringify(_log, null, 2);
    },

    clear(): void {
      _log.splice(0, _log.length);
    },

    getBySignal(label: string): AuditEntry[] {
      return _log.filter(e => e.signalLabel === label);
    },

    getByUser(userId: string): AuditEntry[] {
      return _log.filter(e => e.userId === userId);
    },

    stop(): void {
      _setSignalWriteHook(null);
    },
  };
}
