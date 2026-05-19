export interface DAPPermissions {
  read: string[];
  write: string[];
  watch: string[];
}

export interface DAPSession {
  id: string;
  agentId: string;
  connectedAt: number;
  permissions: DAPPermissions;
}

export interface DAPSignalSnapshot {
  name: string;
  value: unknown;
  updatedAt: number;
  readonly: boolean;
}

export interface DAPWriteResult {
  success: boolean;
  name: string;
  previousValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export interface DAPWatchEvent {
  name: string;
  value: unknown;
  previousValue: unknown;
  timestamp: number;
}

export interface DAPServerOptions {
  permissions?: DAPPermissions;
  onAgentConnect?: (session: DAPSession) => void;
  onAgentDisconnect?: (session: DAPSession) => void;
  onWrite?: (session: DAPSession, name: string, value: unknown) => void | Promise<void>;
  maxSessions?: number;
}

export interface DAPServer {
  register(name: string, signal: { get(): unknown; set?(v: unknown): void }): void;
  unregister(name: string): void;
  getSnapshot(session: DAPSession): DAPSignalSnapshot[];
  read(session: DAPSession, name: string): DAPSignalSnapshot | null;
  write(session: DAPSession, name: string, value: unknown): Promise<DAPWriteResult>;
  watch(session: DAPSession, patterns: string[], callback: (event: DAPWatchEvent) => void): () => void;
  createSession(agentId: string, permissions?: Partial<DAPPermissions>): DAPSession;
  endSession(sessionId: string): void;
  getSessions(): DAPSession[];
  exportSignalMap(): Record<string, { value: unknown; writable: boolean; type: string }>;
  handleRequest(request: Request, sessionId?: string): Promise<Response>;
  dispose(): void;
}

interface RegisteredSignal {
  get(): unknown;
  set?(v: unknown): void;
  updatedAt: number;
}

type WatchCallback = (event: DAPWatchEvent) => void;

interface WatchEntry {
  sessionId: string;
  patterns: string[];
  callback: WatchCallback;
}

const DEFAULT_PERMISSIONS: DAPPermissions = {
  read: ['*'],
  write: [],
  watch: ['*'],
};

function matchesPattern(name: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return name === prefix || name.startsWith(prefix + '.');
  }
  return name === pattern;
}

function matchesAnyPattern(name: string, patterns: string[]): boolean {
  return patterns.some(p => matchesPattern(name, p));
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DAP-Session-ID',
    },
  });
}

export function createDAPServer(options: DAPServerOptions = {}): DAPServer {
  const {
    permissions: defaultPermissions = DEFAULT_PERMISSIONS,
    onAgentConnect,
    onAgentDisconnect,
    onWrite,
    maxSessions = 100,
  } = options;

  const signals = new Map<string, RegisteredSignal>();
  const sessions = new Map<string, DAPSession>();
  const watchers: WatchEntry[] = [];

  function notifyWatchers(name: string, value: unknown, previousValue: unknown): void {
    const event: DAPWatchEvent = { name, value, previousValue, timestamp: Date.now() };
    for (const watcher of watchers) {
      if (matchesAnyPattern(name, watcher.patterns)) {
        const session = sessions.get(watcher.sessionId);
        if (session && matchesAnyPattern(name, session.permissions.watch)) {
          watcher.callback(event);
        }
      }
    }
  }

  const server: DAPServer = {
    register(name, signal) {
      const existing = signals.get(name);
      const currentValue = signal.get();
      const previousValue = existing ? existing.get() : undefined;

      signals.set(name, { ...signal, updatedAt: Date.now() });

      if (existing && currentValue !== previousValue) {
        notifyWatchers(name, currentValue, previousValue);
      }
    },

    unregister(name) {
      signals.delete(name);
    },

    getSnapshot(session) {
      const result: DAPSignalSnapshot[] = [];
      for (const [name, sig] of signals) {
        if (matchesAnyPattern(name, session.permissions.read)) {
          result.push({
            name,
            value: sig.get(),
            updatedAt: sig.updatedAt,
            readonly: sig.set === undefined,
          });
        }
      }
      return result;
    },

    read(session, name) {
      if (!matchesAnyPattern(name, session.permissions.read)) return null;
      const sig = signals.get(name);
      if (!sig) return null;
      return {
        name,
        value: sig.get(),
        updatedAt: sig.updatedAt,
        readonly: sig.set === undefined,
      };
    },

    async write(session, name, value) {
      const timestamp = Date.now();

      if (!matchesAnyPattern(name, session.permissions.write)) {
        return { success: false, name, previousValue: undefined, newValue: value, timestamp };
      }

      const sig = signals.get(name);
      if (!sig || !sig.set) {
        return { success: false, name, previousValue: undefined, newValue: value, timestamp };
      }

      const previousValue = sig.get();
      await onWrite?.(session, name, value);
      sig.set(value);
      sig.updatedAt = timestamp;
      notifyWatchers(name, value, previousValue);

      return { success: true, name, previousValue, newValue: value, timestamp };
    },

    watch(session, patterns, callback) {
      const entry: WatchEntry = { sessionId: session.id, patterns, callback };
      watchers.push(entry);
      return () => {
        const idx = watchers.indexOf(entry);
        if (idx !== -1) watchers.splice(idx, 1);
      };
    },

    createSession(agentId, permissions) {
      if (sessions.size >= maxSessions) {
        throw new Error(`Maximum sessions (${maxSessions}) reached`);
      }
      const session: DAPSession = {
        id: generateId(),
        agentId,
        connectedAt: Date.now(),
        permissions: {
          read: permissions?.read ?? defaultPermissions.read,
          write: permissions?.write ?? defaultPermissions.write,
          watch: permissions?.watch ?? defaultPermissions.watch,
        },
      };
      sessions.set(session.id, session);
      onAgentConnect?.(session);
      return session;
    },

    endSession(sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        sessions.delete(sessionId);
        const indices: number[] = [];
        for (let i = watchers.length - 1; i >= 0; i--) {
          if (watchers[i]!.sessionId === sessionId) indices.push(i);
        }
        for (const i of indices) watchers.splice(i, 1);
        onAgentDisconnect?.(session);
      }
    },

    getSessions() {
      return Array.from(sessions.values());
    },

    exportSignalMap() {
      const map: Record<string, { value: unknown; writable: boolean; type: string }> = {};
      for (const [name, sig] of signals) {
        const value = sig.get();
        map[name] = { value, writable: sig.set !== undefined, type: typeof value };
      }
      return map;
    },

    async handleRequest(request, sessionId) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DAP-Session-ID',
          },
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      const resolvedSessionId = sessionId ?? request.headers.get('X-DAP-Session-ID') ?? undefined;

      function getSession(): DAPSession | null {
        if (!resolvedSessionId) return null;
        return sessions.get(resolvedSessionId) ?? null;
      }

      if (request.method === 'GET' && path === '/dap/signals') {
        const session = getSession();
        if (!session) return jsonResponse({ error: 'Session required' }, 401);
        return jsonResponse(server.getSnapshot(session));
      }

      const signalMatch = path.match(/^\/dap\/signals\/(.+)$/);
      if (signalMatch) {
        const name = decodeURIComponent(signalMatch[1]!);

        if (request.method === 'GET') {
          const session = getSession();
          if (!session) return jsonResponse({ error: 'Session required' }, 401);
          const snapshot = server.read(session, name);
          if (!snapshot) return jsonResponse({ error: 'Not found or access denied' }, 404);
          return jsonResponse(snapshot);
        }

        if (request.method === 'POST') {
          const session = getSession();
          if (!session) return jsonResponse({ error: 'Session required' }, 401);
          let body: { value: unknown };
          try {
            body = await request.json() as { value: unknown };
          } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
          }
          const result = await server.write(session, name, body.value);
          return jsonResponse(result, result.success ? 200 : 403);
        }
      }

      if (request.method === 'GET' && path === '/dap/map') {
        return jsonResponse(server.exportSignalMap());
      }

      if (path === '/dap/sessions') {
        if (request.method === 'GET') {
          return jsonResponse(server.getSessions());
        }

        if (request.method === 'POST') {
          let body: { agentId: string; permissions?: Partial<DAPPermissions> };
          try {
            body = await request.json() as { agentId: string; permissions?: Partial<DAPPermissions> };
          } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
          }
          if (!body.agentId) return jsonResponse({ error: 'agentId required' }, 400);
          const session = server.createSession(body.agentId, body.permissions);
          return jsonResponse(session, 201);
        }
      }

      return jsonResponse({ error: 'Not found' }, 404);
    },

    dispose() {
      for (const session of sessions.values()) {
        onAgentDisconnect?.(session);
      }
      sessions.clear();
      signals.clear();
      watchers.length = 0;
    },
  };

  return server;
}
