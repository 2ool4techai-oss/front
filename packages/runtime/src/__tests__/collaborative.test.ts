import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCollabSession } from '../collaborative.js';

// ── Mock WebSocket ─────────────────────────────────────────────────────

class MockWS {
  static lastInstance: MockWS;
  readyState = 0; // CONNECTING
  sentMessages: string[] = [];

  private _handlers: Record<string, Array<(e: unknown) => void>> = {};

  constructor(public url: string) {
    MockWS.lastInstance = this;
  }

  open(): void {
    this.readyState = 1;
    this._dispatch('open', {});
  }

  close(): void {
    this.readyState = 3;
    this._dispatch('close', {});
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  receive(data: unknown): void {
    this._dispatch('message', { data: JSON.stringify(data) });
  }

  addEventListener(event: string, handler: (e: unknown) => void): void {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  }

  private _dispatch(event: string, payload: unknown): void {
    for (const h of (this._handlers[event] ?? [])) h(payload);
  }
}

// Cast to satisfy TypeScript when passing as WebSocketImpl
const MockWSImpl = MockWS as unknown as typeof WebSocket;

// ── Tests ──────────────────────────────────────────────────────────────

describe('createCollabSession', () => {
  beforeEach(() => {
    // Reset lastInstance
    (MockWS as { lastInstance?: MockWS }).lastInstance = undefined as unknown as MockWS;
  });

  it('creates a session with a generated clientId', () => {
    const session = createCollabSession({ WebSocketImpl: MockWSImpl });
    expect(typeof session.clientId).toBe('string');
    expect(session.clientId.startsWith('client_')).toBe(true);
    session.destroy();
  });

  it('uses a provided clientId', () => {
    const session = createCollabSession({ clientId: 'alice', WebSocketImpl: MockWSImpl });
    expect(session.clientId).toBe('alice');
    session.destroy();
  });

  it('connects to WebSocket and sets connected=true on open', () => {
    const session = createCollabSession({
      url:           'ws://localhost:1234',
      clientId:      'alice',
      WebSocketImpl: MockWSImpl,
    });

    expect(session.connected.peek()).toBe(false);

    MockWS.lastInstance.open();

    expect(session.connected.peek()).toBe(true);
    session.destroy();
  });

  it('collaborative signal broadcasts set() calls as JSON', () => {
    const session = createCollabSession({
      url:           'ws://localhost:1234',
      clientId:      'alice',
      WebSocketImpl: MockWSImpl,
    });
    MockWS.lastInstance.open();

    const count = session.signal('counter', 0);
    const ws    = MockWS.lastInstance;
    const before = ws.sentMessages.length;

    count.set(42);

    const newMessages = ws.sentMessages.slice(before);
    expect(newMessages.length).toBe(1);
    const raw = newMessages[0];
    expect(raw).toBeDefined();
    const msg = JSON.parse(raw!) as Record<string, unknown>;
    expect(msg.type).toBe('set');
    expect(msg.key).toBe('counter');
    expect(msg.value).toBe(42);
    expect(msg.clientId).toBe('alice');
    expect(typeof msg.clock).toBe('object');

    session.destroy();
  });

  it('receiving a remote set() updates the signal', () => {
    const session = createCollabSession({
      url:           'ws://localhost:1234',
      clientId:      'alice',
      WebSocketImpl: MockWSImpl,
    });
    MockWS.lastInstance.open();

    const count = session.signal('counter', 0);
    expect(count.peek()).toBe(0);

    MockWS.lastInstance.receive({
      type:      'set',
      key:       'counter',
      value:     99,
      clientId:  'bob',
      clock:     { bob: 1 },
      timestamp: Date.now(),
    });

    expect(count.peek()).toBe(99);
    session.destroy();
  });

  it('echo suppression: ignores ops from own clientId', () => {
    const session = createCollabSession({
      url:           'ws://localhost:1234',
      clientId:      'alice',
      WebSocketImpl: MockWSImpl,
    });
    MockWS.lastInstance.open();

    const count = session.signal('counter', 0);
    count.set(10);

    // Server echoes back our own op
    MockWS.lastInstance.receive({
      type:      'set',
      key:       'counter',
      value:     999,
      clientId:  'alice',
      clock:     { alice: 99 },
      timestamp: Date.now(),
    });

    // Value should stay at 10 (set locally), not 999
    expect(count.peek()).toBe(10);
    session.destroy();
  });

  it('vector clock conflict resolution: higher clock wins', () => {
    const session = createCollabSession({
      url:           'ws://localhost:1234',
      clientId:      'alice',
      WebSocketImpl: MockWSImpl,
    });
    MockWS.lastInstance.open();

    const count = session.signal('counter', 0);
    const ws    = MockWS.lastInstance;

    // Apply a remote op with clock sum = 2
    ws.receive({
      type:      'set',
      key:       'counter',
      value:     10,
      clientId:  'bob',
      clock:     { bob: 2 },
      timestamp: Date.now() - 1000,
    });
    expect(count.peek()).toBe(10);

    // Try to apply an older op with clock sum = 1 — should be discarded
    ws.receive({
      type:      'set',
      key:       'counter',
      value:     5,
      clientId:  'charlie',
      clock:     { charlie: 1 },
      timestamp: Date.now(),
    });
    expect(count.peek()).toBe(10); // still 10, not 5

    // Apply a newer op with clock sum = 3 — should win
    ws.receive({
      type:      'set',
      key:       'counter',
      value:     20,
      clientId:  'dave',
      clock:     { dave: 3 },
      timestamp: Date.now(),
    });
    expect(count.peek()).toBe(20);

    session.destroy();
  });

  it('updatePresence() broadcasts and updates local peers', () => {
    const session = createCollabSession({
      url:           'ws://localhost:1234',
      clientId:      'alice',
      WebSocketImpl: MockWSImpl,
    });
    MockWS.lastInstance.open();

    const ws     = MockWS.lastInstance;
    const before = ws.sentMessages.length;

    session.updatePresence({ cursor: { x: 10, y: 20 } });

    // Should have sent a presence message
    const newMessages = ws.sentMessages.slice(before);
    expect(newMessages.length).toBe(1);
    const raw2 = newMessages[0];
    expect(raw2).toBeDefined();
    const msg = JSON.parse(raw2!) as Record<string, unknown>;
    expect(msg.type).toBe('presence');
    expect(msg.clientId).toBe('alice');
    expect((msg.data as Record<string, unknown>).cursor).toEqual({ x: 10, y: 20 });

    // Should have updated local peers
    const peerList = session.peers.peek();
    expect(peerList.some(p => p.clientId === 'alice')).toBe(true);

    session.destroy();
  });

  it('receiving presence from another client adds to peers', () => {
    const session = createCollabSession({
      url:           'ws://localhost:1234',
      clientId:      'alice',
      WebSocketImpl: MockWSImpl,
    });
    MockWS.lastInstance.open();

    expect(session.peers.peek().length).toBe(0);

    MockWS.lastInstance.receive({
      type:      'presence',
      clientId:  'bob',
      data:      { cursor: { x: 5, y: 15 } },
      timestamp: Date.now(),
    });

    const peerList = session.peers.peek();
    expect(peerList.length).toBe(1);
    const bobPeer = peerList[0];
    expect(bobPeer?.clientId).toBe('bob');
    expect(bobPeer?.data.cursor).toEqual({ x: 5, y: 15 });

    session.destroy();
  });

  it('destroy() closes WebSocket', () => {
    const session = createCollabSession({
      url:           'ws://localhost:1234',
      clientId:      'alice',
      WebSocketImpl: MockWSImpl,
      reconnect:     false,
    });
    MockWS.lastInstance.open();
    expect(session.connected.peek()).toBe(true);

    const closeSpy = vi.spyOn(MockWS.lastInstance, 'close');
    session.destroy();

    expect(closeSpy).toHaveBeenCalled();
    expect(session.connected.peek()).toBe(false);
  });

  it('works without a URL (local-only mode)', () => {
    // No url, no WebSocketImpl — should not throw
    const session = createCollabSession({ clientId: 'local' });
    const count   = session.signal('counter', 0);

    // set() should still work locally
    count.set(7);
    expect(count.peek()).toBe(7);

    // connected stays false
    expect(session.connected.peek()).toBe(false);

    session.destroy();
  });
});
