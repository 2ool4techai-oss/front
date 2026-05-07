import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '../signal.js';
import { persistSignal, createPersistedStore } from '../persist.js';

// jsdom provides localStorage
beforeEach(() => localStorage.clear());

describe('persistSignal', () => {
  it('persists value to localStorage on set', () => {
    const s = persistSignal('test:count', signal(0));
    s.set(42);
    expect(JSON.parse(localStorage.getItem('test:count')!)).toBe(42);
  });

  it('loads persisted value on creation', () => {
    localStorage.setItem('test:name', JSON.stringify('Alice'));
    const s = persistSignal('test:name', signal(''));
    expect(s()).toBe('Alice');
  });

  it('handles missing storage key gracefully', () => {
    const s = persistSignal('test:missing', signal(99));
    expect(s()).toBe(99);
  });

  it('clear() removes key from storage', () => {
    const s = persistSignal('test:clear', signal(5));
    s.clear();
    expect(localStorage.getItem('test:clear')).toBeNull();
  });

  it('uses custom serialize/deserialize', () => {
    const s = persistSignal<Date>('test:date', signal(new Date('2024-01-01')), {
      serialize:   (d) => d.toISOString(),
      deserialize: (s) => new Date(s),
    });
    const d = new Date('2024-06-15');
    s.set(d);
    const raw = localStorage.getItem('test:date');
    expect(raw).toContain('2024-06-15');
    // Reload
    const s2 = persistSignal<Date>('test:date', signal(new Date('2000-01-01')), {
      serialize:   (d) => d.toISOString(),
      deserialize: (s) => new Date(s),
    });
    expect(s2().getFullYear()).toBe(2024);
  });

  it('uses sessionStorage when storage option is session', () => {
    const s = persistSignal('test:session', signal('hello'), { storage: 'session' });
    s.set('world');
    expect(sessionStorage.getItem('test:session')).toBe('"world"');
    expect(localStorage.getItem('test:session')).toBeNull();
  });
});

describe('createPersistedStore', () => {
  it('persists store state', () => {
    const store = createPersistedStore('store:prefs', { theme: 'light', size: 14 });
    store.set({ theme: 'dark' });
    const saved = JSON.parse(localStorage.getItem('store:prefs')!);
    expect(saved.theme).toBe('dark');
    expect(saved.size).toBe(14);
  });

  it('loads persisted state on creation', () => {
    localStorage.setItem('store:saved', JSON.stringify({ theme: 'dark', size: 16 }));
    const store = createPersistedStore('store:saved', { theme: 'light', size: 14 });
    expect(store.get().theme).toBe('dark');
    expect(store.get().size).toBe(16);
  });

  it('reset() reverts to initial values', () => {
    const store = createPersistedStore('store:reset', { x: 1 });
    store.set({ x: 999 });
    store.reset();
    expect(store.get().x).toBe(1);
  });
});
