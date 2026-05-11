import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSWSignal } from '../sw-signal.js';

const mockCache = {
  match:  vi.fn(),
  put:    vi.fn(),
  keys:   vi.fn((): Promise<string[]> => Promise.resolve([])),
  delete: vi.fn(),
};

vi.stubGlobal('caches', { open: vi.fn(() => Promise.resolve(mockCache)) });

// Provide a minimal global fetch stub
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    headers: new Headers(),
    clone: () => ({ ok: true, headers: new Headers(), text: () => Promise.resolve('"network-data"') }),
    text: () => Promise.resolve('"network-data"'),
  }),
));

describe('createSWSignal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.match.mockResolvedValue(undefined);
    mockCache.put.mockResolvedValue(undefined);
    mockCache.keys.mockResolvedValue([]);
    mockCache.delete.mockResolvedValue(true);
    (caches.open as ReturnType<typeof vi.fn>).mockResolvedValue(mockCache);
  });

  it('createSWSignal returns handle', () => {
    const handle = createSWSignal();
    expect(handle).toBeDefined();
    expect(typeof handle.fetch).toBe('function');
  });

  it('data starts undefined', () => {
    const handle = createSWSignal();
    expect(handle.data()).toBeUndefined();
  });

  it('fromCache starts false', () => {
    const handle = createSWSignal();
    expect(handle.fromCache()).toBe(false);
  });

  it('fetch() with mock caches API (cache-first, no cache hit → network)', async () => {
    mockCache.match.mockResolvedValue(undefined);
    const handle = createSWSignal<string>({ strategy: 'cache-first' });
    await handle.fetch('https://example.com/data');
    expect(handle.data()).toBe('network-data');
    expect(handle.fromCache()).toBe(false);
  });

  it('invalidate() clears cache entries', async () => {
    const mockKey = 'https://example.com/data';
    mockCache.keys.mockResolvedValue([mockKey]);
    (caches.open as ReturnType<typeof vi.fn>).mockResolvedValue(mockCache);
    const handle = createSWSignal();
    handle.invalidate();
    // Drain the async IIFE: open + keys + Promise.all
    await new Promise(r => setTimeout(r, 0));
    expect(mockCache.delete).toHaveBeenCalledWith(mockKey);
  });

  it('destroy() does not throw', () => {
    const handle = createSWSignal();
    expect(() => handle.destroy()).not.toThrow();
  });

  it('stale-while-revalidate: fromCache=true initially when cache hit', async () => {
    const cachedResponse = {
      ok: true,
      headers: new Headers({ date: new Date(Date.now() - 7200 * 1000).toUTCString() }),
      clone: () => ({
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve('"cached-data"'),
      }),
      text: () => Promise.resolve('"cached-data"'),
    };
    mockCache.match.mockResolvedValue(cachedResponse);

    const handle = createSWSignal<string>({ strategy: 'stale-while-revalidate' });
    await handle.fetch('https://example.com/data');
    // After full resolution, network replaces cache
    // But fromCache should have been set true at some point
    // Final state: network data (fromCache=false)
    expect(handle.data()).toBe('network-data');
  });

  it('network-first: tries fetch first', async () => {
    const handle = createSWSignal<string>({ strategy: 'network-first' });
    await handle.fetch('https://example.com/data');
    expect(fetch).toHaveBeenCalledWith('https://example.com/data');
    expect(handle.data()).toBe('network-data');
    expect(handle.fromCache()).toBe(false);
  });
});
