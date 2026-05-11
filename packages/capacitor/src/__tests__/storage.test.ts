import { describe, it, expect, vi } from 'vitest';
import { createCapacitorStorage } from '../storage.js';
import type { CapacitorPreferences } from '../storage.js';

function makePrefs(initial?: Record<string, string>): CapacitorPreferences {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    get:    async ({ key }) => ({ value: store.get(key) ?? null }),
    set:    async ({ key, value }) => { store.set(key, value); },
    remove: async ({ key }) => { store.delete(key); },
    clear:  async () => { store.clear(); },
    keys:   async () => ({ keys: [...store.keys()] }),
  };
}

describe('createCapacitorStorage', () => {
  it('creates handle', () => {
    expect(() => createCapacitorStorage(makePrefs(), { key: 'test', defaultValue: 0 })).not.toThrow();
  });

  it('initial value is defaultValue before load', () => {
    const h = createCapacitorStorage(makePrefs(), { key: 'test', defaultValue: 42 });
    expect(h.value).toBe(42);
  });

  it('set() persists value', async () => {
    const h = createCapacitorStorage(makePrefs(), { key: 'count', defaultValue: 0 });
    await h.set(99);
    expect(h.value).toBe(99);
  });

  it('remove() resets to defaultValue', async () => {
    const h = createCapacitorStorage(makePrefs(), { key: 'count', defaultValue: 0 });
    await h.set(5);
    await h.remove();
    expect(h.value).toBe(0);
  });

  it('reload() loads from store', async () => {
    const prefs = makePrefs({ myKey: '{"foo":42}' });
    const h = createCapacitorStorage(prefs, { key: 'myKey', defaultValue: {} as Record<string, number> });
    await h.reload();
    expect((h.value as Record<string, number>)['foo']).toBe(42);
  });

  it('loading starts true', () => {
    const h = createCapacitorStorage(makePrefs(), { key: 'test', defaultValue: 0 });
    expect(h.loading).toBe(true);
  });
});
