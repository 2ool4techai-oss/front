import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sseSignal } from '../sse-signal.js';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  dispatch(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  dispatchError() {
    this.onerror?.(new Event('error'));
  }
}

describe('sseSignal', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('status() starts as "connecting"', () => {
    const handle = sseSignal('http://localhost/events');
    expect(handle.status()).toBe('connecting');
    handle.close();
  });

  it('receiving a JSON message updates data()', () => {
    const handle = sseSignal<{ value: number }>('http://localhost/events');
    const es = MockEventSource.instances[0];
    es!.dispatch(JSON.stringify({ value: 42 }));
    expect(handle.data()).toEqual({ value: 42 });
    handle.close();
  });

  it('status() becomes "open" after receiving a message', () => {
    const handle = sseSignal('http://localhost/events');
    const es = MockEventSource.instances[0];
    es!.dispatch(JSON.stringify({ hello: 'world' }));
    expect(handle.status()).toBe('open');
    handle.close();
  });

  it('close() sets status to "closed"', () => {
    const handle = sseSignal('http://localhost/events');
    handle.close();
    expect(handle.status()).toBe('closed');
  });

  it('gracefully handles when EventSource is not available', () => {
    vi.unstubAllGlobals();
    // Remove EventSource from global
    const saved = (globalThis as Record<string, unknown>).EventSource;
    delete (globalThis as Record<string, unknown>).EventSource;

    const handle = sseSignal('http://localhost/events');
    expect(handle.status()).toBe('error');

    // Restore
    (globalThis as Record<string, unknown>).EventSource = saved;
  });

  it('retryCount() starts at 0', () => {
    const handle = sseSignal('http://localhost/events');
    expect(handle.retryCount()).toBe(0);
    handle.close();
  });

  it('retryCount() increments on error', () => {
    const handle = sseSignal('http://localhost/events', { reconnectMs: 5000, maxRetries: 5 });
    const es = MockEventSource.instances[0];
    es!.dispatchError();
    expect(handle.retryCount()).toBe(1);
    handle.close();
  });

  it('schedules reconnect after error', () => {
    const handle = sseSignal('http://localhost/events', { reconnectMs: 3000, maxRetries: 0 });
    const es = MockEventSource.instances[0];
    es!.dispatchError();
    expect(MockEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(MockEventSource.instances).toHaveLength(2);
    handle.close();
  });

  it('close() prevents reconnect after error', () => {
    const handle = sseSignal('http://localhost/events', { reconnectMs: 1000 });
    const es = MockEventSource.instances[0];
    es!.dispatchError();
    handle.close();
    vi.advanceTimersByTime(5000);
    // Should not have reconnected
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('parseJson=false stores raw string in data()', () => {
    const handle = sseSignal<string>('http://localhost/events', { parseJson: false });
    const es = MockEventSource.instances[0];
    es!.dispatch('{"raw":true}');
    expect(handle.data()).toBe('{"raw":true}');
    handle.close();
  });

  it('onError callback is called on error event', () => {
    const onError = vi.fn();
    const handle = sseSignal('http://localhost/events', { onError, maxRetries: 1 });
    const es = MockEventSource.instances[0];
    es!.dispatchError();
    expect(onError).toHaveBeenCalledOnce();
    handle.close();
  });

  it('stops retrying after maxRetries is reached', () => {
    const handle = sseSignal('http://localhost/events', { reconnectMs: 1000, maxRetries: 2 });
    const es0 = MockEventSource.instances[0];
    es0!.dispatchError(); // retry 1
    vi.advanceTimersByTime(1000);
    const es1 = MockEventSource.instances[1];
    es1!.dispatchError(); // retry 2
    vi.advanceTimersByTime(1000);
    const es2 = MockEventSource.instances[2];
    es2!.dispatchError(); // retry 3 — should NOT happen (maxRetries=2 means 2 retries after initial)
    vi.advanceTimersByTime(1000);
    // After 3 total errors (retryCount=3 > maxRetries=2), no new instance
    expect(MockEventSource.instances).toHaveLength(3);
    handle.close();
  });
});
