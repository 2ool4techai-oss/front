import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wsSignal } from '../ws-signal-new.js';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  protocols?: string | string[];
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  readyState = 0; // CONNECTING

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols ?? '';
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

describe('wsSignal', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('initial status is "connecting"', () => {
    const handle = wsSignal('ws://localhost');
    expect(handle.status()).toBe('connecting');
    handle.close();
  });

  it('status becomes "open" after connection', () => {
    const handle = wsSignal('ws://localhost');
    MockWebSocket.instances[0]!.simulateOpen();
    expect(handle.status()).toBe('open');
    handle.close();
  });

  it('receiving a JSON message updates data()', () => {
    const handle = wsSignal<{ msg: string }>('ws://localhost');
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({ msg: 'hello' }));
    expect(handle.data()).toEqual({ msg: 'hello' });
    handle.close();
  });

  it('send() serializes objects to JSON', () => {
    const handle = wsSignal('ws://localhost');
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    handle.send({ key: 'value' });
    expect(ws.sent).toContain(JSON.stringify({ key: 'value' }));
    handle.close();
  });

  it('send() sends string as-is', () => {
    const handle = wsSignal<string>('ws://localhost');
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    handle.send('plain text');
    expect(ws.sent).toContain('plain text');
    handle.close();
  });

  it('close() sets status to "closed"', () => {
    const handle = wsSignal('ws://localhost');
    handle.close();
    expect(handle.status()).toBe('closed');
  });

  it('handles missing WebSocket gracefully', () => {
    vi.unstubAllGlobals();
    const saved = (globalThis as Record<string, unknown>).WebSocket;
    delete (globalThis as Record<string, unknown>).WebSocket;

    const handle = wsSignal('ws://localhost');
    expect(handle.status()).toBe('error');

    (globalThis as Record<string, unknown>).WebSocket = saved;
  });

  it('retryCount() starts at 0', () => {
    const handle = wsSignal('ws://localhost');
    expect(handle.retryCount()).toBe(0);
    handle.close();
  });

  it('queues messages when not open and sends on connect', () => {
    const handle = wsSignal('ws://localhost');
    // Not yet open (readyState=0)
    handle.send({ queued: true });
    const ws = MockWebSocket.instances[0]!;
    expect(ws.sent).toHaveLength(0);
    ws.simulateOpen();
    expect(ws.sent).toContain(JSON.stringify({ queued: true }));
    handle.close();
  });

  it('reconnects after non-intentional close', () => {
    const handle = wsSignal('ws://localhost', { reconnectMs: 2000, maxRetries: 0 });
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    // Simulate server-side close (non-intentional)
    ws.readyState = 3;
    ws.onclose?.();
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(2000);
    expect(MockWebSocket.instances).toHaveLength(2);
    handle.close();
  });

  it('close() prevents reconnect after non-intentional close', () => {
    const handle = wsSignal('ws://localhost', { reconnectMs: 1000 });
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    ws.readyState = 3;
    ws.onclose?.();
    handle.close();
    vi.advanceTimersByTime(5000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('onOpen callback is called', () => {
    const onOpen = vi.fn();
    const handle = wsSignal('ws://localhost', { onOpen });
    MockWebSocket.instances[0]!.simulateOpen();
    expect(onOpen).toHaveBeenCalledOnce();
    handle.close();
  });

  it('onError callback is called on error', () => {
    const onError = vi.fn();
    const handle = wsSignal('ws://localhost', { onError });
    MockWebSocket.instances[0]!.simulateError();
    expect(onError).toHaveBeenCalledOnce();
    handle.close();
  });

  it('parseJson=false stores raw string in data()', () => {
    const handle = wsSignal<string>('ws://localhost', { parseJson: false });
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    ws.simulateMessage('{"raw":true}');
    expect(handle.data()).toBe('{"raw":true}');
    handle.close();
  });
});
