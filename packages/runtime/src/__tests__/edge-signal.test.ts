import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  edgeSignal,
  isEdgeContext,
  getEdgeRegion,
  detectPlatform,
  createEdgeHandler,
  injectState,
  mergeHeaders,
} from '../edge.js';

beforeEach(() => {
  // Clean up global edge signals map between tests
  const win = globalThis as Record<string, unknown>;
  delete win['__DRISHTI_EDGE_SIGNALS__'];
  delete win['__DRISHTI_EDGE_REGION__'];
  delete win['CF_REGION'];
});

// ── isEdgeContext ──────────────────────────────────────────────────────

describe('isEdgeContext', () => {
  it('returns false in browser-like environment (jsdom has document)', () => {
    expect(isEdgeContext()).toBe(false);
  });
});

// ── getEdgeRegion ──────────────────────────────────────────────────────

describe('getEdgeRegion', () => {
  it('returns null when no region is set', () => {
    expect(getEdgeRegion()).toBeNull();
  });

  it('returns the __DRISHTI_EDGE_REGION__ global if set', () => {
    (globalThis as Record<string, unknown>)['__DRISHTI_EDGE_REGION__'] = 'us-east-1';
    expect(getEdgeRegion()).toBe('us-east-1');
    delete (globalThis as Record<string, unknown>)['__DRISHTI_EDGE_REGION__'];
  });

  it('returns the CF_REGION global as fallback', () => {
    (globalThis as Record<string, unknown>)['CF_REGION'] = 'eu-west-1';
    expect(getEdgeRegion()).toBe('eu-west-1');
    delete (globalThis as Record<string, unknown>)['CF_REGION'];
  });
});

// ── edgeSignal ─────────────────────────────────────────────────────────

describe('edgeSignal', () => {
  it('holds the initial value', () => {
    const s = edgeSignal('hello', { key: 'test:greeting' });
    expect(s()).toBe('hello');
    expect(s.peek()).toBe('hello');
  });

  it('exposes key and region', () => {
    const s = edgeSignal(0, { key: 'counter', region: 'us-east-1' });
    expect(s.key).toBe('counter');
    expect(s.region).toBe('us-east-1');
  });

  it('region is undefined when not specified', () => {
    const s = edgeSignal(0, { key: 'no-region' });
    expect(s.region).toBeUndefined();
  });

  it('set() updates the value', () => {
    const s = edgeSignal(10, { key: 'mutable' });
    s.set(42);
    expect(s()).toBe(42);
  });

  it('subscribe() fires immediately with current value', () => {
    const s = edgeSignal('init', { key: 'sub-test' });
    const spy = vi.fn();
    s.subscribe(spy);
    expect(spy).toHaveBeenCalledWith('init');
  });

  it('subscribe() fires when value changes', () => {
    const s = edgeSignal(0, { key: 'reactive' });
    const spy = vi.fn();
    s.subscribe(spy);
    spy.mockClear();
    s.set(99);
    expect(spy).toHaveBeenCalledWith(99);
  });

  it('rehydrate() updates value from server', () => {
    const s = edgeSignal('client', { key: 'rehydrate-test' });
    s.rehydrate('server-value');
    expect(s()).toBe('server-value');
  });

  it('invalidate() resets to fallback and marks expired', () => {
    const s = edgeSignal('active', { key: 'invalidate-test', fallback: 'fallback-val' });
    s.set('changed');
    s.invalidate();
    expect(s()).toBe('fallback-val');
  });

  it('invalidate() resets to initial when no fallback', () => {
    const s = edgeSignal('original', { key: 'no-fallback-invalidate' });
    s.set('modified');
    s.invalidate();
    expect(s()).toBe('original');
  });

  it('reads from __DRISHTI_EDGE_SIGNALS__ window map if present', () => {
    const win = globalThis as Record<string, unknown>;
    win['__DRISHTI_EDGE_SIGNALS__'] = { 'server-sig': 'from-server' };
    const s = edgeSignal('client-default', { key: 'server-sig' });
    expect(s()).toBe('from-server');
    delete win['__DRISHTI_EDGE_SIGNALS__'];
  });

  it('TTL: returns fallback after cache expiry', async () => {
    // Create signal with a tiny TTL
    vi.useFakeTimers();
    const s = edgeSignal('fresh', { key: 'ttl-sig', ttl: 1, fallback: 'stale' });
    expect(s()).toBe('fresh');
    // Advance time past TTL
    vi.advanceTimersByTime(1001);
    expect(s()).toBe('stale');
    vi.useRealTimers();
  });

  it('rehydrate() resets TTL expiry', () => {
    vi.useFakeTimers();
    const s = edgeSignal('v1', { key: 'ttl-rehydrate', ttl: 1, fallback: 'expired' });
    vi.advanceTimersByTime(2000); // expire it
    expect(s()).toBe('expired');
    s.rehydrate('v2-fresh');
    expect(s()).toBe('v2-fresh'); // TTL refreshed by rehydrate
    vi.useRealTimers();
  });
});

// ── Existing edge.ts API is still present ─────────────────────────────

describe('detectPlatform (pre-existing)', () => {
  it('detects node in test environment', () => {
    expect(detectPlatform()).toBe('node');
  });
});

describe('injectState (pre-existing)', () => {
  it('injects script before </body>', () => {
    const html = '<html><body><p>Hi</p></body></html>';
    const result = injectState(html, { foo: 'bar' });
    expect(result).toContain('<script>window.__DRISHTI_STATE__');
    expect(result.indexOf('</body>')).toBeGreaterThan(result.indexOf('__DRISHTI_STATE__'));
  });
});

describe('mergeHeaders (pre-existing)', () => {
  it('merges two header objects, override wins', () => {
    const merged = mergeHeaders({ 'Content-Type': 'text/html', 'X-Foo': 'base' }, { 'X-Foo': 'override' });
    expect(merged['Content-Type']).toBe('text/html');
    expect(merged['X-Foo']).toBe('override');
  });
});

describe('createEdgeHandler (pre-existing)', () => {
  it('returns a 200 response with correct headers', async () => {
    const handler = createEdgeHandler(async () => ({ html: '<h1>hello</h1>', status: 200 }));
    const req = new Request('https://example.com/');
    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html');
  });
});
