import { describe, it, expect, vi } from 'vitest';
import { createDAPServer } from '../dap.js';
import type { DAPSession, DAPWatchEvent } from '../dap.js';

function makeSignal(initial: unknown) {
  let val = initial;
  return {
    get: () => val,
    set: (v: unknown) => { val = v; },
  };
}

function makeReadonlySignal(value: unknown) {
  return { get: () => value };
}

describe('createDAPServer', () => {
  describe('createSession', () => {
    it('creates session with default permissions', () => {
      const server = createDAPServer();
      const session = server.createSession('agent-1');
      expect(session.agentId).toBe('agent-1');
      expect(session.permissions.read).toEqual(['*']);
      expect(session.permissions.write).toEqual([]);
      expect(session.permissions.watch).toEqual(['*']);
      expect(typeof session.id).toBe('string');
      expect(typeof session.connectedAt).toBe('number');
    });

    it('creates session with custom permissions', () => {
      const server = createDAPServer();
      const session = server.createSession('agent-2', {
        read: ['user.*'],
        write: ['user.name'],
        watch: ['user.*'],
      });
      expect(session.permissions.read).toEqual(['user.*']);
      expect(session.permissions.write).toEqual(['user.name']);
      expect(session.permissions.watch).toEqual(['user.*']);
    });

    it('calls onAgentConnect callback', () => {
      const onAgentConnect = vi.fn();
      const server = createDAPServer({ onAgentConnect });
      const session = server.createSession('agent-3');
      expect(onAgentConnect).toHaveBeenCalledWith(session);
    });

    it('assigns unique ids to sessions', () => {
      const server = createDAPServer();
      const s1 = server.createSession('a');
      const s2 = server.createSession('b');
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe('register / unregister', () => {
    it('registers a signal and makes it readable', () => {
      const server = createDAPServer();
      const session = server.createSession('agent');
      server.register('count', makeSignal(5));
      const snap = server.read(session, 'count');
      expect(snap).not.toBeNull();
      expect(snap!.value).toBe(5);
    });

    it('unregisters a signal', () => {
      const server = createDAPServer();
      const session = server.createSession('agent');
      server.register('count', makeSignal(5));
      server.unregister('count');
      const snap = server.read(session, 'count');
      expect(snap).toBeNull();
    });

    it('readonly flag is true when signal has no set', () => {
      const server = createDAPServer();
      const session = server.createSession('agent');
      server.register('ro', makeReadonlySignal(42));
      const snap = server.read(session, 'ro');
      expect(snap!.readonly).toBe(true);
    });

    it('readonly flag is false when signal has set', () => {
      const server = createDAPServer();
      const session = server.createSession('agent');
      server.register('rw', makeSignal(42));
      const snap = server.read(session, 'rw');
      expect(snap!.readonly).toBe(false);
    });
  });

  describe('read with permission check', () => {
    it('allows read when pattern matches *', () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['*'] });
      server.register('foo', makeSignal('bar'));
      expect(server.read(session, 'foo')).not.toBeNull();
    });

    it('allows read when pattern matches prefix wildcard', () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['user.*'] });
      server.register('user.name', makeSignal('Alice'));
      expect(server.read(session, 'user.name')).not.toBeNull();
    });

    it('denies read when pattern does not match', () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['user.*'] });
      server.register('system.config', makeSignal('secret'));
      expect(server.read(session, 'system.config')).toBeNull();
    });

    it('denies read when read list is empty', () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: [] });
      server.register('foo', makeSignal(1));
      expect(server.read(session, 'foo')).toBeNull();
    });
  });

  describe('write with permission check', () => {
    it('allows write when pattern matches', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { write: ['user.*'] });
      server.register('user.name', makeSignal('Alice'));
      const result = await server.write(session, 'user.name', 'Bob');
      expect(result.success).toBe(true);
      expect(result.previousValue).toBe('Alice');
      expect(result.newValue).toBe('Bob');
    });

    it('denies write when pattern does not match', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { write: ['user.*'] });
      server.register('system.flag', makeSignal(false));
      const result = await server.write(session, 'system.flag', true);
      expect(result.success).toBe(false);
    });

    it('denies write on readonly signal', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { write: ['*'] });
      server.register('ro', makeReadonlySignal(42));
      const result = await server.write(session, 'ro', 99);
      expect(result.success).toBe(false);
    });

    it('denies write when write list is empty', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent');
      server.register('count', makeSignal(0));
      const result = await server.write(session, 'count', 1);
      expect(result.success).toBe(false);
    });

    it('calls onWrite hook before writing', async () => {
      const onWrite = vi.fn();
      const server = createDAPServer({ onWrite });
      const session = server.createSession('agent', { write: ['*'] });
      server.register('x', makeSignal(0));
      await server.write(session, 'x', 42);
      expect(onWrite).toHaveBeenCalledWith(session, 'x', 42);
    });
  });

  describe('getSnapshot', () => {
    it('returns all readable signals', () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['*'] });
      server.register('a', makeSignal(1));
      server.register('b', makeSignal(2));
      const snap = server.getSnapshot(session);
      const names = snap.map(s => s.name);
      expect(names).toContain('a');
      expect(names).toContain('b');
    });

    it('filters signals by read permission', () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['user.*'] });
      server.register('user.name', makeSignal('Alice'));
      server.register('system.key', makeSignal('secret'));
      const snap = server.getSnapshot(session);
      const names = snap.map(s => s.name);
      expect(names).toContain('user.name');
      expect(names).not.toContain('system.key');
    });
  });

  describe('exportSignalMap', () => {
    it('returns signal map with value, writable, and type', () => {
      const server = createDAPServer();
      server.register('count', makeSignal(10));
      server.register('label', makeReadonlySignal('hello'));
      const map = server.exportSignalMap();
      expect(map['count']).toEqual({ value: 10, writable: true, type: 'number' });
      expect(map['label']).toEqual({ value: 'hello', writable: false, type: 'string' });
    });

    it('infers type as object for objects', () => {
      const server = createDAPServer();
      server.register('config', makeSignal({ theme: 'dark' }));
      const map = server.exportSignalMap();
      expect(map['config']!.type).toBe('object');
    });

    it('infers type as boolean', () => {
      const server = createDAPServer();
      server.register('flag', makeSignal(true));
      const map = server.exportSignalMap();
      expect(map['flag']!.type).toBe('boolean');
    });
  });

  describe('handleRequest', () => {
    it('GET /dap/signals returns snapshot', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['*'] });
      server.register('x', makeSignal(7));
      const req = new Request('http://localhost/dap/signals', {
        headers: { 'X-DAP-Session-ID': session.id },
      });
      const res = await server.handleRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json() as { name: string; value: unknown }[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.some(s => s.name === 'x' && s.value === 7)).toBe(true);
    });

    it('GET /dap/signals returns 401 without session', async () => {
      const server = createDAPServer();
      const req = new Request('http://localhost/dap/signals');
      const res = await server.handleRequest(req);
      expect(res.status).toBe(401);
    });

    it('GET /dap/signals/:name returns single signal', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['*'] });
      server.register('user.name', makeSignal('Alice'));
      const req = new Request('http://localhost/dap/signals/user.name', {
        headers: { 'X-DAP-Session-ID': session.id },
      });
      const res = await server.handleRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json() as { name: string; value: unknown };
      expect(body.name).toBe('user.name');
      expect(body.value).toBe('Alice');
    });

    it('POST /dap/signals/:name writes value', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['*'], write: ['*'] });
      server.register('count', makeSignal(0));
      const req = new Request('http://localhost/dap/signals/count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DAP-Session-ID': session.id,
        },
        body: JSON.stringify({ value: 99 }),
      });
      const res = await server.handleRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; newValue: unknown };
      expect(body.success).toBe(true);
      expect(body.newValue).toBe(99);
    });

    it('POST /dap/signals/:name returns 403 on permission denied', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { write: [] });
      server.register('count', makeSignal(0));
      const req = new Request('http://localhost/dap/signals/count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DAP-Session-ID': session.id,
        },
        body: JSON.stringify({ value: 99 }),
      });
      const res = await server.handleRequest(req);
      expect(res.status).toBe(403);
    });

    it('GET /dap/map returns signal map without session', async () => {
      const server = createDAPServer();
      server.register('flag', makeSignal(true));
      const req = new Request('http://localhost/dap/map');
      const res = await server.handleRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, { writable: boolean; type: string }>;
      expect(body['flag']!.type).toBe('boolean');
    });

    it('GET /dap/sessions returns session list', async () => {
      const server = createDAPServer();
      server.createSession('agent-x');
      const req = new Request('http://localhost/dap/sessions');
      const res = await server.handleRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json() as DAPSession[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.some(s => s.agentId === 'agent-x')).toBe(true);
    });

    it('POST /dap/sessions creates a session', async () => {
      const server = createDAPServer();
      const req = new Request('http://localhost/dap/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'new-agent' }),
      });
      const res = await server.handleRequest(req);
      expect(res.status).toBe(201);
      const body = await res.json() as DAPSession;
      expect(body.agentId).toBe('new-agent');
      expect(typeof body.id).toBe('string');
    });

    it('returns 404 for unknown routes', async () => {
      const server = createDAPServer();
      const req = new Request('http://localhost/dap/unknown');
      const res = await server.handleRequest(req);
      expect(res.status).toBe(404);
    });

    it('OPTIONS returns CORS headers', async () => {
      const server = createDAPServer();
      const req = new Request('http://localhost/dap/signals', { method: 'OPTIONS' });
      const res = await server.handleRequest(req);
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('passes sessionId param to override header', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['*'] });
      server.register('y', makeSignal(3));
      const req = new Request('http://localhost/dap/signals');
      const res = await server.handleRequest(req, session.id);
      expect(res.status).toBe(200);
    });
  });

  describe('watch', () => {
    it('callback fires when signal is written', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { write: ['*'], watch: ['*'] });
      server.register('score', makeSignal(0));
      const events: DAPWatchEvent[] = [];
      server.watch(session, ['*'], e => events.push(e));
      await server.write(session, 'score', 10);
      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe('score');
      expect(events[0]!.value).toBe(10);
      expect(events[0]!.previousValue).toBe(0);
    });

    it('callback does not fire for unmatched pattern', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { write: ['*'], watch: ['user.*'] });
      server.register('system.x', makeSignal(0));
      const events: DAPWatchEvent[] = [];
      server.watch(session, ['user.*'], e => events.push(e));
      await server.write(session, 'system.x', 1);
      expect(events).toHaveLength(0);
    });

    it('unsubscribe stops callback', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { write: ['*'], watch: ['*'] });
      server.register('val', makeSignal(0));
      const events: DAPWatchEvent[] = [];
      const unsub = server.watch(session, ['*'], e => events.push(e));
      unsub();
      await server.write(session, 'val', 5);
      expect(events).toHaveLength(0);
    });
  });

  describe('endSession', () => {
    it('removes session from getSessions', () => {
      const server = createDAPServer();
      const session = server.createSession('agent');
      expect(server.getSessions()).toHaveLength(1);
      server.endSession(session.id);
      expect(server.getSessions()).toHaveLength(0);
    });

    it('calls onAgentDisconnect', () => {
      const onAgentDisconnect = vi.fn();
      const server = createDAPServer({ onAgentDisconnect });
      const session = server.createSession('agent');
      server.endSession(session.id);
      expect(onAgentDisconnect).toHaveBeenCalledWith(session);
    });

    it('removes watchers for ended session', async () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { write: ['*'], watch: ['*'] });
      server.register('z', makeSignal(0));
      const events: DAPWatchEvent[] = [];
      server.watch(session, ['*'], e => events.push(e));
      server.endSession(session.id);
      const writeSession = server.createSession('writer', { write: ['*'] });
      await server.write(writeSession, 'z', 99);
      expect(events).toHaveLength(0);
    });
  });

  describe('getSessions', () => {
    it('returns all active sessions', () => {
      const server = createDAPServer();
      server.createSession('a');
      server.createSession('b');
      expect(server.getSessions()).toHaveLength(2);
    });
  });

  describe('dispose', () => {
    it('clears all sessions and signals', () => {
      const server = createDAPServer();
      const session = server.createSession('agent', { read: ['*'] });
      server.register('x', makeSignal(1));
      server.dispose();
      expect(server.getSessions()).toHaveLength(0);
      expect(server.getSnapshot(session)).toHaveLength(0);
    });
  });
});
