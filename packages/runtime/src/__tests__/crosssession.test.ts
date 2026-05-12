import { describe, it, expect, beforeEach } from 'vitest';
import { createLearningProfile, adaptiveSignal } from '../crosssession.js';

beforeEach(() => {
  localStorage.clear();
});

describe('createLearningProfile', () => {
  it('returns a profile store with profile, record, adapt, reset, export, import', () => {
    const store = createLearningProfile();
    expect(typeof store.profile).toBe('function');
    expect(typeof store.record).toBe('function');
    expect(typeof store.adapt).toBe('function');
    expect(typeof store.reset).toBe('function');
    expect(typeof store.export).toBe('function');
    expect(typeof store.import).toBe('function');
  });

  it('profile has preferences and patterns', () => {
    const store = createLearningProfile();
    const p = store.profile();
    expect(p).toHaveProperty('preferences');
    expect(p).toHaveProperty('patterns');
  });

  it('record tracks action frequency', () => {
    const store = createLearningProfile();
    store.record('click-hero');
    store.record('click-hero');
    const pattern = store.profile().patterns.find(p => p.action === 'click-hero');
    expect(pattern).toBeDefined();
    expect(pattern!.frequency).toBeGreaterThanOrEqual(2);
  });

  it('reset clears patterns', () => {
    const store = createLearningProfile();
    store.record('nav');
    store.reset();
    expect(store.profile().patterns).toHaveLength(0);
  });

  it('export returns current profile', () => {
    const store = createLearningProfile();
    store.record('test-action');
    const exported = store.export();
    expect(exported.patterns.some(p => p.action === 'test-action')).toBe(true);
  });

  it('import restores a profile', () => {
    const store = createLearningProfile();
    store.record('original');
    const exported = store.export();
    store.reset();
    store.import(exported);
    expect(store.profile().patterns.some(p => p.action === 'original')).toBe(true);
  });

  it('adapt returns a reactive function', () => {
    const store = createLearningProfile();
    const fn = store.adapt('theme', 'light');
    expect(typeof fn).toBe('function');
    expect(fn()).toBe('light');
  });

  it('persists to localStorage', () => {
    const store = createLearningProfile({ userId: 'user-1' });
    store.record('login');
    expect(localStorage.getItem('__drishti_profile_user-1__')).not.toBeNull();
  });
});

describe('adaptiveSignal', () => {
  it('returns an adaptive signal with read, set, preferred, frequencies', () => {
    const s = adaptiveSignal('blue', { key: 'theme-color' });
    expect(typeof s).toBe('function');
    expect(typeof s.set).toBe('function');
    expect(typeof s.preferred).toBe('function');
    expect(typeof s.frequencies).toBe('function');
  });

  it('initial value is accessible', () => {
    const s = adaptiveSignal(42, { key: 'test-adaptive-1' });
    expect(s()).toBe(42);
  });

  it('set updates the value', () => {
    const s = adaptiveSignal('red', { key: 'test-adaptive-2' });
    s.set('blue');
    expect(s()).toBe('blue');
  });

  it('preferred returns most frequent value', () => {
    const s = adaptiveSignal('a', { key: 'test-adaptive-3' });
    s.set('b'); s.set('b'); s.set('b');
    s.set('a');
    expect(s.preferred()).toBe('b');
  });

  it('frequencies returns sorted value frequencies', () => {
    const s = adaptiveSignal('x', { key: 'test-adaptive-4' });
    s.set('y'); s.set('y');
    const freqs = s.frequencies();
    expect(Array.isArray(freqs)).toBe(true);
    expect(freqs[0].frequency).toBeGreaterThanOrEqual(freqs[freqs.length - 1]?.frequency ?? 0);
  });
});
