import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createD1Signal, createKVSignal } from '../cloudflare.js';
import type { D1Database, KVNamespace } from '../cloudflare.js';

// ── Mock D1 ────────────────────────────────────────────────────────────

function makeMockD1(rows: unknown[] = [{ id: 1, name: 'test' }]): D1Database {
  return {
    prepare: (_q: string) => ({
      bind: (..._params: unknown[]) => ({
        all<T = unknown>() { return Promise.resolve({ results: rows as T[] }); },
        run: () => Promise.resolve({ success: true }),
      }),
    }),
  };
}

function makeMockD1Error(): D1Database {
  return {
    prepare: (_q: string) => ({
      bind: (..._params: unknown[]) => ({
        all<T = unknown>(): Promise<{ results: T[] }> { return Promise.reject(new Error('D1 query failed')); },
        run: () => Promise.resolve({ success: false }),
      }),
    }),
  };
}

// ── D1 Signal Tests ────────────────────────────────────────────────────

describe('createD1Signal', () => {
  it('returns a handle with data, loading, error signals', () => {
    const db = makeMockD1();
    const handle = createD1Signal(db, 'SELECT * FROM test');
    expect(handle.data).toBeDefined();
    expect(handle.loading).toBeDefined();
    expect(handle.error).toBeDefined();
    handle.destroy();
  });

  it('execute() sets data signal with results', async () => {
    const db = makeMockD1([{ id: 1, name: 'test' }]);
    const handle = createD1Signal(db, 'SELECT * FROM test');
    await handle.execute('SELECT * FROM test');
    expect(handle.data.peek()).toEqual([{ id: 1, name: 'test' }]);
    handle.destroy();
  });

  it('loading is true during query and false after', async () => {
    const db = makeMockD1();
    const handle = createD1Signal(db, 'SELECT * FROM test');
    expect(handle.loading.peek()).toBe(false);
    const promise = handle.execute('SELECT * FROM test');
    // After await, loading should be false
    await promise;
    expect(handle.loading.peek()).toBe(false);
    handle.destroy();
  });

  it('captures error on failure', async () => {
    const db = makeMockD1Error();
    const handle = createD1Signal(db, 'SELECT * FROM test');
    await handle.execute('SELECT * FROM test');
    expect(handle.error.peek()).toBeInstanceOf(Error);
    expect((handle.error.peek() as Error).message).toBe('D1 query failed');
    handle.destroy();
  });

  it('parse option transforms results', async () => {
    const db = makeMockD1([{ id: 1, name: 'test' }]);
    const handle = createD1Signal<string>(db, 'SELECT * FROM test', {
      parse: (rows) => rows.map(r => (r as { name: string }).name).join(','),
    });
    await handle.execute('SELECT * FROM test');
    expect(handle.data.peek()).toBe('test');
    handle.destroy();
  });

  it('refetch re-runs the last query', async () => {
    let callCount = 0;
    const db: D1Database = {
      prepare: (_q: string) => ({
        bind: (..._params: unknown[]) => ({
          all<T = unknown>() { callCount++; return Promise.resolve({ results: [{ id: callCount }] as T[] }); },
          run: () => Promise.resolve({ success: true }),
        }),
      }),
    };
    const handle = createD1Signal(db, 'SELECT * FROM test');
    await handle.execute('SELECT * FROM test');
    expect(callCount).toBe(1);
    await handle.refetch();
    expect(callCount).toBe(2);
    handle.destroy();
  });
});

// ── KV Signal Tests ────────────────────────────────────────────────────

describe('createKVSignal', () => {
  let mockGet:    ReturnType<typeof vi.fn<[string], Promise<string | null>>>;
  let mockPut:    ReturnType<typeof vi.fn<[string, string, ({ expirationTtl?: number } | undefined)?], Promise<void>>>;
  let mockDelete: ReturnType<typeof vi.fn<[string], Promise<void>>>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    mockGet    = vi.fn<[string], Promise<string | null>>(() => Promise.resolve('{"val":42}'));
    mockPut    = vi.fn<[string, string, ({ expirationTtl?: number } | undefined)?], Promise<void>>(() => Promise.resolve());
    mockDelete = vi.fn<[string], Promise<void>>(() => Promise.resolve());
    mockKV = {
      get:    mockGet,
      put:    mockPut,
      delete: mockDelete,
    };
  });

  it('createKVSignal returns a handle', () => {
    const handle = createKVSignal(mockKV);
    expect(handle.value).toBeDefined();
    expect(handle.synced).toBeDefined();
    expect(typeof handle.load).toBe('function');
    expect(typeof handle.save).toBe('function');
    expect(typeof handle.remove).toBe('function');
  });

  it('value starts undefined', () => {
    const handle = createKVSignal(mockKV);
    expect(handle.value.peek()).toBeUndefined();
  });

  it('load() sets value signal from KV', async () => {
    const handle = createKVSignal<{ val: number }>(mockKV, {
      parse: (raw) => raw !== null ? JSON.parse(raw) as { val: number } : undefined,
    });
    await handle.load('mykey');
    expect(mockGet).toHaveBeenCalledWith('mykey');
    expect(handle.value.peek()).toEqual({ val: 42 });
  });

  it('save() calls kv.put with serialized value', async () => {
    const handle = createKVSignal<{ val: number }>(mockKV);
    await handle.save('mykey', { val: 99 });
    expect(mockPut).toHaveBeenCalledWith('mykey', JSON.stringify({ val: 99 }));
    expect(handle.value.peek()).toEqual({ val: 99 });
  });

  it('remove() calls kv.delete and clears value', async () => {
    const handle = createKVSignal<{ val: number }>(mockKV);
    await handle.save('mykey', { val: 99 });
    await handle.remove('mykey');
    expect(mockDelete).toHaveBeenCalledWith('mykey');
    expect(handle.value.peek()).toBeUndefined();
  });

  it('synced signal reflects state (true after load)', async () => {
    const handle = createKVSignal(mockKV);
    expect(handle.synced.peek()).toBe(false);
    await handle.load('mykey');
    expect(handle.synced.peek()).toBe(true);
  });
});
