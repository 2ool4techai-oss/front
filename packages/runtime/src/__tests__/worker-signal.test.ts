import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWorkerSignal } from '../worker-signal.js';

class MockWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror:   ((e: ErrorEvent) => void) | null = null;
  postMessage(data: unknown) {
    setTimeout(() => this.onmessage?.({ data: { ok: true, result: data } }), 0);
  }
  terminate() {}
}

vi.stubGlobal('Worker', MockWorker);
vi.stubGlobal('URL', { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} });
vi.stubGlobal('Blob', class MockBlob {
  constructor(public parts: string[], public opts?: { type?: string }) {}
});

describe('createWorkerSignal', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('createWorkerSignal returns handle', () => {
    const handle = createWorkerSignal((x: number) => x * 2);
    expect(handle).toBeDefined();
    expect(typeof handle.run).toBe('function');
    handle.terminate();
  });

  it('result starts undefined', () => {
    const handle = createWorkerSignal((x: number) => x);
    expect(handle.result()).toBeUndefined();
    handle.terminate();
  });

  it('loading starts false', () => {
    const handle = createWorkerSignal((x: number) => x);
    expect(handle.loading()).toBe(false);
    handle.terminate();
  });

  it('run() sets loading true then false', async () => {
    const handle = createWorkerSignal((x: number) => x);
    const promise = handle.run(42);
    expect(handle.loading()).toBe(true);
    await vi.runAllTimersAsync();
    await promise;
    expect(handle.loading()).toBe(false);
    handle.terminate();
  });

  it('terminate() does not throw', () => {
    const handle = createWorkerSignal((x: number) => x);
    expect(() => handle.terminate()).not.toThrow();
  });

  it('run() resolves with result', async () => {
    const handle = createWorkerSignal((x: number) => x);
    const promise = handle.run(99);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe(99);
    handle.terminate();
  });

  it('result signal updated after run()', async () => {
    const handle = createWorkerSignal((x: number) => x);
    const promise = handle.run(7);
    await vi.runAllTimersAsync();
    await promise;
    expect(handle.result()).toBe(7);
    handle.terminate();
  });

  it('error signal set when worker posts error', async () => {
    class ErrorWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror:   ((e: ErrorEvent) => void) | null = null;
      postMessage(_data: unknown) {
        setTimeout(() => this.onmessage?.({ data: { ok: false, error: 'Something went wrong' } }), 0);
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', ErrorWorker);

    const handle = createWorkerSignal((x: number) => x);
    const promise = handle.run(1).catch(() => {});
    await vi.runAllTimersAsync();
    await promise;
    expect(handle.error()).toBeInstanceOf(Error);

    // restore
    vi.stubGlobal('Worker', MockWorker);
    handle.terminate();
  });
});
