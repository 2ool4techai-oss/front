// ── Enterprise Audit Log ────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: number;
  sessionId?: string;
  agentId?: string;
  signalName: string;
  action: 'read' | 'write' | 'watch' | 'unwatch';
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  hash: string;
}

export interface AuditLogOptions {
  maxEntries?: number;
  onEntry?: (entry: AuditEntry) => void;
  exportFormat?: 'json' | 'csv' | 'splunk';
  redactPatterns?: string[];
}

export interface AuditLog {
  record(params: {
    signalName: string;
    action: AuditEntry['action'];
    previousValue?: unknown;
    newValue?: unknown;
    sessionId?: string;
    agentId?: string;
    metadata?: Record<string, unknown>;
  }): AuditEntry;

  getEntries(filter?: {
    signalName?: string;
    action?: AuditEntry['action'];
    sessionId?: string;
    agentId?: string;
    from?: number;
    to?: number;
  }): AuditEntry[];

  export(format?: 'json' | 'csv' | 'splunk'): string;

  verify(): { valid: boolean; tamperedEntries: string[] };

  clear(): void;
  getStats(): { total: number; byAction: Record<string, number>; bySignal: Record<string, number> };
}

// ── ID generator ────────────────────────────────────────────────────────

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Hash ────────────────────────────────────────────────────────────────

function computeHash(entry: {
  timestamp: number;
  signalName: string;
  action: string;
  newValue?: unknown;
}): string {
  const raw = JSON.stringify({
    timestamp: entry.timestamp,
    signalName: entry.signalName,
    action: entry.action,
    newValue: entry.newValue,
  });
  // Simple deterministic string hash — btoa of the JSON, trimmed to 32 chars
  // btoa may not handle non-Latin chars; use encodeURIComponent to be safe
  try {
    return btoa(encodeURIComponent(raw)).slice(0, 32);
  } catch {
    // Fallback: djb2-style hash as hex string
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
      h = ((h << 5) + h) ^ raw.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(16).padStart(8, '0').slice(0, 32);
  }
}

// ── Redaction helpers ───────────────────────────────────────────────────

function matchesRedactPattern(signalName: string, patterns: string[]): boolean {
  return patterns.some(p => signalName === p || signalName.startsWith(p + '.'));
}

// ── Factory ─────────────────────────────────────────────────────────────

export function createAuditLog(options?: AuditLogOptions): AuditLog {
  const maxEntries = options?.maxEntries ?? 10000;
  const redactPatterns = options?.redactPatterns ?? [];
  const onEntry = options?.onEntry;
  const defaultFormat = options?.exportFormat ?? 'json';

  const entries: AuditEntry[] = [];

  const log: AuditLog = {
    record(params): AuditEntry {
      const shouldRedact = matchesRedactPattern(params.signalName, redactPatterns);
      const previousValue = shouldRedact ? '[REDACTED]' : params.previousValue;
      const newValue = shouldRedact ? '[REDACTED]' : params.newValue;

      const timestamp = Date.now();
      const hash = computeHash({
        timestamp,
        signalName: params.signalName,
        action: params.action,
        newValue,
      });

      const entry: AuditEntry = {
        id: genId(),
        timestamp,
        signalName: params.signalName,
        action: params.action,
        previousValue,
        newValue,
        hash,
      };

      if (params.sessionId !== undefined) entry.sessionId = params.sessionId;
      if (params.agentId !== undefined) entry.agentId = params.agentId;
      if (params.metadata !== undefined) entry.metadata = params.metadata;

      entries.push(entry);

      // Trim oldest entries when over limit
      if (entries.length > maxEntries) {
        entries.splice(0, entries.length - maxEntries);
      }

      onEntry?.(entry);
      return entry;
    },

    getEntries(filter): AuditEntry[] {
      if (!filter) return [...entries];

      return entries.filter(e => {
        if (filter.signalName !== undefined && e.signalName !== filter.signalName) return false;
        if (filter.action !== undefined && e.action !== filter.action) return false;
        if (filter.sessionId !== undefined && e.sessionId !== filter.sessionId) return false;
        if (filter.agentId !== undefined && e.agentId !== filter.agentId) return false;
        if (filter.from !== undefined && e.timestamp < filter.from) return false;
        if (filter.to !== undefined && e.timestamp > filter.to) return false;
        return true;
      });
    },

    export(format?: 'json' | 'csv' | 'splunk'): string {
      const fmt = format ?? defaultFormat;

      if (fmt === 'json') {
        return JSON.stringify(entries);
      }

      if (fmt === 'csv') {
        const headers = 'id,timestamp,sessionId,agentId,signalName,action,hash';
        const rows = entries.map(e =>
          [
            e.id,
            e.timestamp,
            e.sessionId ?? '',
            e.agentId ?? '',
            e.signalName,
            e.action,
            e.hash,
          ]
            .map(v => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        );
        return [headers, ...rows].join('\n');
      }

      // splunk: NDJSON — one JSON object per line
      return entries.map(e => JSON.stringify(e)).join('\n');
    },

    verify(): { valid: boolean; tamperedEntries: string[] } {
      const tamperedEntries: string[] = [];

      for (const entry of entries) {
        const expectedHash = computeHash({
          timestamp: entry.timestamp,
          signalName: entry.signalName,
          action: entry.action,
          newValue: entry.newValue,
        });
        if (entry.hash !== expectedHash) {
          tamperedEntries.push(entry.id);
        }
      }

      return {
        valid: tamperedEntries.length === 0,
        tamperedEntries,
      };
    },

    clear(): void {
      entries.length = 0;
    },

    getStats(): { total: number; byAction: Record<string, number>; bySignal: Record<string, number> } {
      const byAction: Record<string, number> = {};
      const bySignal: Record<string, number> = {};

      for (const e of entries) {
        byAction[e.action] = (byAction[e.action] ?? 0) + 1;
        bySignal[e.signalName] = (bySignal[e.signalName] ?? 0) + 1;
      }

      return { total: entries.length, byAction, bySignal };
    },
  };

  return log;
}
