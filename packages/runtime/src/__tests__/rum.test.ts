import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRUM } from '../rum.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createRUM', () => {
  it('returns handle with vitals signal', () => {
    const h = createRUM();
    expect(h.vitals).toBeDefined();
    expect(typeof h.vitals.peek).toBe('function');
    h.destroy();
  });

  it('vitals starts with all null fields', () => {
    const h = createRUM();
    const v = h.vitals.peek();
    expect(v.lcp).toBeNull();
    expect(v.fid).toBeNull();
    expect(v.cls).toBeNull();
    expect(v.fcp).toBeNull();
    expect(v.ttfb).toBeNull();
    h.destroy();
  });

  it('errors signal starts empty', () => {
    const h = createRUM();
    expect(h.errors.peek()).toEqual([]);
    h.destroy();
  });

  it('pageViews starts at 1 (or increments)', () => {
    const h = createRUM();
    expect(h.pageViews.peek()).toBeGreaterThanOrEqual(1);
    h.destroy();
  });

  it('flush() does not throw when no endpoint is set', () => {
    const h = createRUM();
    expect(() => h.flush()).not.toThrow();
    h.destroy();
  });

  it('destroy() does not throw', () => {
    const h = createRUM();
    expect(() => h.destroy()).not.toThrow();
  });

  it('RUMHandle has correct shape', () => {
    const h = createRUM();
    expect(typeof h.flush).toBe('function');
    expect(typeof h.destroy).toBe('function');
    expect(h.vitals).toBeDefined();
    expect(h.errors).toBeDefined();
    expect(h.pageViews).toBeDefined();
    h.destroy();
  });

  it('vitals signal is reactive (can subscribe)', () => {
    const h = createRUM();
    const values: unknown[] = [];
    const unsub = h.vitals.subscribe((v) => { values.push(v); });
    expect(values.length).toBeGreaterThanOrEqual(1);
    unsub();
    h.destroy();
  });
});
