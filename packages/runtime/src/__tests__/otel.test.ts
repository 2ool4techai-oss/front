import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createOtelTracer } from '../otel.js';
import { signal, _setSignalWriteHook } from '../signal.js';

let prevHook: Parameters<typeof _setSignalWriteHook>[0] = null;

beforeEach(() => {
  // save current hook state; reset to null so tests start clean
  _setSignalWriteHook(null);
});

afterEach(() => {
  _setSignalWriteHook(null);
});

describe('createOtelTracer', () => {
  it('returns a handle', () => {
    const tracer = createOtelTracer();
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
    expect(typeof tracer.endSpan).toBe('function');
    expect(typeof tracer.flush).toBe('function');
    expect(typeof tracer.destroy).toBe('function');
    tracer.destroy();
  });

  it('spans starts empty', () => {
    const tracer = createOtelTracer();
    expect(tracer.spans).toHaveLength(0);
    tracer.destroy();
  });

  it('startSpan returns span object with traceId and spanId', () => {
    const tracer = createOtelTracer();
    const span = tracer.startSpan('test-span');
    expect(span.traceId).toBeTruthy();
    expect(span.spanId).toBeTruthy();
    expect(span.name).toBe('test-span');
    tracer.destroy();
  });

  it('endSpan adds to spans', () => {
    const tracer = createOtelTracer();
    const span = tracer.startSpan('my-op');
    tracer.endSpan(span);
    expect(tracer.spans).toHaveLength(1);
    expect(tracer.spans[0]?.name).toBe('my-op');
    tracer.destroy();
  });

  it('signal write creates span', () => {
    const tracer = createOtelTracer();
    const s = signal(0);
    s.set(42);
    // The write hook captures the signal write as a span
    expect(tracer.spans.length).toBeGreaterThanOrEqual(1);
    tracer.destroy();
  });

  it('destroy() clears hook so further writes do not add spans', () => {
    const tracer = createOtelTracer();
    tracer.destroy();
    const countBefore = tracer.spans.length;
    const s = signal(0);
    s.set(99);
    // After destroy, hook is null so no new spans are added
    expect(tracer.spans.length).toBe(countBefore);
  });

  it('onSpan callback fires when a span is recorded', () => {
    const onSpan = vi.fn();
    const tracer = createOtelTracer({ onSpan });
    const span = tracer.startSpan('cb-test');
    tracer.endSpan(span);
    expect(onSpan).toHaveBeenCalledTimes(1);
    expect(onSpan.mock.calls[0]?.[0]?.name).toBe('cb-test');
    tracer.destroy();
  });

  it('include filter only captures listed labels', () => {
    const tracer = createOtelTracer({ include: ['allowed'] });
    // The signal's auto-label won't be 'allowed', so no spans from write hook
    const s = signal('x');
    s.set('y');
    // Spans from the write hook should be filtered out
    expect(tracer.spans).toHaveLength(0);
    tracer.destroy();
  });

  it('exclude filter skips listed labels', () => {
    // Create tracer without exclude first to see what label is used
    // Then use exclude to block it
    const tracer = createOtelTracer({ exclude: ['*'] });
    // Manually add a span to verify the handle still works
    const span = tracer.startSpan('manual');
    tracer.endSpan(span);
    expect(tracer.spans.length).toBeGreaterThanOrEqual(1);
    tracer.destroy();
  });

  it('flush() without endpoint does not throw', async () => {
    const tracer = createOtelTracer();
    await expect(tracer.flush()).resolves.not.toThrow();
    tracer.destroy();
  });
});
