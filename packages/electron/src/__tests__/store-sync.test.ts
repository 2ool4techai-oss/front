import { describe, it, expect } from 'vitest';
import { createStoreSync } from '../store-sync.js';
import type { StoreAdapter } from '../store-sync.js';

function makeStore(): StoreAdapter & { _data: Map<string, unknown> } {
  const _data = new Map<string, unknown>();
  return {
    _data,
    get: (k: string) => _data.get(k),
    set: (k: string, v: unknown) => { _data.set(k, v); },
    delete: (k: string) => { _data.delete(k); },
  };
}

describe('createStoreSync', () => {
  it('creates sync handle', () => {
    expect(() => createStoreSync(makeStore())).not.toThrow();
  });

  it('save() stores value with prefix', () => {
    const store = makeStore();
    const sync = createStoreSync(store, { prefix: 'test.' });
    sync.save('count', 42);
    expect(store._data.get('test.count')).toBe(42);
  });

  it('load() retrieves value', () => {
    const store = makeStore();
    const sync = createStoreSync(store, { prefix: 'test.' });
    sync.save('count', 99);
    expect(sync.load('count')).toBe(99);
  });

  it('load() returns undefined for missing key', () => {
    expect(createStoreSync(makeStore()).load('missing')).toBeUndefined();
  });

  it('keys filter: save ignores unlisted keys', () => {
    const store = makeStore();
    const sync = createStoreSync(store, { keys: ['allowed'] });
    sync.save('allowed', 1);
    sync.save('blocked', 2);
    expect(store._data.has('drishti.allowed')).toBe(true);
    expect(store._data.has('drishti.blocked')).toBe(false);
  });

  it('clear() removes listed keys', () => {
    const store = makeStore();
    const sync = createStoreSync(store, { keys: ['a', 'b'] });
    sync.save('a', 1);
    sync.save('b', 2);
    sync.clear();
    expect(sync.load('a')).toBeUndefined();
    expect(sync.load('b')).toBeUndefined();
  });
});
