// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { workerSignal } from '../worker-signal.js';

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private _listener: ((e: MessageEvent) => void) | null = null;

  postMessage(data: unknown) {
    // Simulate async worker response
    setTimeout(() => {
      const msg = data as { type: string; payload: unknown };
      if (msg.type === 'run') {
        const result = (msg.payload as number) * 2; // double the input
        this._listener?.({ data: { type: 'result', payload: result } } as MessageEvent);
      }
    }, 0);
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void) {
    if (type === 'message') this._listener = listener;
  }

  removeEventListener() {}
  terminate() {}
}

describe('workerSignal', () => {
  it('starts with result undefined and loading false', () => {
    const handle = workerSignal({ worker: new MockWorker() as unknown as Worker });
    expect(handle.result()).toBeUndefined();
    expect(handle.loading()).toBe(false);
    expect(handle.error()).toBeNull();
  });

  it('run() sets loading to true', () => {
    const handle = workerSignal({ worker: new MockWorker() as unknown as Worker });
    handle.run(5);
    expect(handle.loading()).toBe(true);
  });

  it('result() is set after worker responds', async () => {
    const handle = workerSignal({ worker: new MockWorker() as unknown as Worker });
    handle.run(21);
    await new Promise(r => setTimeout(r, 10));
    expect(handle.result()).toBe(42);
    expect(handle.loading()).toBe(false);
  });

  it('terminate() does not throw', () => {
    const handle = workerSignal({ worker: new MockWorker() as unknown as Worker });
    expect(() => handle.terminate()).not.toThrow();
  });
});
