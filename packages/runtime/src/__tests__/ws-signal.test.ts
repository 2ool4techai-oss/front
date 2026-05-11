import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWSSignal } from '../ws-signal.js';

class MockWS {
  static instance: MockWS;
  onopen:    (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror:   ((e: Event) => void) | null = null;
  onclose:   (() => void) | null = null;
  sent: string[] = [];
  readyState = 0; // CONNECTING
  constructor(_url: string) { MockWS.instance = this; }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }
}

vi.stubGlobal('WebSocket', MockWS);

describe('createWSSignal', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with status "connecting"', () => {
    const handle = createWSSignal('ws://localhost');
    expect(handle.status()).toBe('connecting');
    handle.destroy();
  });

  it('status becomes "open" on onopen', () => {
    const handle = createWSSignal('ws://localhost');
    MockWS.instance.readyState = 1;
    MockWS.instance.onopen?.();
    expect(handle.status()).toBe('open');
    handle.destroy();
  });

  it('onmessage updates value signal', () => {
    const handle = createWSSignal<{ msg: string }>('ws://localhost');
    MockWS.instance.readyState = 1;
    MockWS.instance.onopen?.();
    MockWS.instance.onmessage?.({ data: JSON.stringify({ msg: 'hello' }) });
    expect(handle.value()).toEqual({ msg: 'hello' });
    handle.destroy();
  });

  it('send() calls ws.send when open', () => {
    const handle = createWSSignal<string>('ws://localhost');
    MockWS.instance.readyState = 1;
    MockWS.instance.onopen?.();
    handle.send('test');
    expect(MockWS.instance.sent).toContain(JSON.stringify('test'));
    handle.destroy();
  });

  it('send() queues message when closed (offlineQueue=true)', () => {
    const handle = createWSSignal<string>('ws://localhost', { offlineQueue: true, reconnect: false });
    // status is 'connecting', readyState = 0 → not open
    handle.send('queued');
    // No send on ws yet
    expect(MockWS.instance.sent).toHaveLength(0);
    handle.destroy();
  });

  it('disconnect() closes WebSocket', () => {
    const handle = createWSSignal('ws://localhost', { reconnect: false });
    MockWS.instance.readyState = 1;
    MockWS.instance.onopen?.();
    handle.disconnect();
    expect(handle.status()).toBe('closed');
    handle.destroy();
  });

  it('destroy() does not throw', () => {
    const handle = createWSSignal('ws://localhost');
    expect(() => handle.destroy()).not.toThrow();
  });

  it('reconnect=false skips reconnect', () => {
    const handle = createWSSignal('ws://localhost', { reconnect: false });
    const firstWS = MockWS.instance;
    MockWS.instance.readyState = 1;
    MockWS.instance.onopen?.();
    MockWS.instance.close();
    // advance timers — no reconnect should happen
    vi.advanceTimersByTime(10000);
    expect(MockWS.instance).toBe(firstWS);
    handle.destroy();
  });

  it('parse option used on incoming messages', () => {
    const parse = vi.fn((raw: string) => ({ parsed: raw }));
    const handle = createWSSignal<{ parsed: string }>('ws://localhost', { parse });
    MockWS.instance.readyState = 1;
    MockWS.instance.onopen?.();
    MockWS.instance.onmessage?.({ data: 'rawdata' });
    expect(parse).toHaveBeenCalledWith('rawdata');
    expect(handle.value()).toEqual({ parsed: 'rawdata' });
    handle.destroy();
  });

  it('status "error" set on onerror', () => {
    const handle = createWSSignal('ws://localhost');
    const fakeEvent = new Event('error');
    MockWS.instance.onerror?.(fakeEvent);
    expect(handle.status()).toBe('error');
    handle.destroy();
  });
});
