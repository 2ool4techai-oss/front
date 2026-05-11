import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConsentManager } from '../consent.js';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem:    (k: string) => store[k] ?? null,
  setItem:    (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  vi.stubGlobal('localStorage', localStorageMock);
});

describe('createConsentManager', () => {
  it('starts with given=false and no timestamp', () => {
    const cm = createConsentManager();
    expect(cm.state().given).toBe(false);
    expect(cm.state().timestamp).toBeNull();
  });

  it('necessary category is always true by default', () => {
    const cm = createConsentManager();
    expect(cm.hasCategory('necessary')).toBe(true);
  });

  it('acceptAll() sets all categories to true', () => {
    const cm = createConsentManager();
    cm.acceptAll();
    const s = cm.state();
    expect(s.given).toBe(true);
    expect(s.categories.functional).toBe(true);
    expect(s.categories.analytics).toBe(true);
    expect(s.categories.marketing).toBe(true);
    expect(s.timestamp).toBeTypeOf('number');
  });

  it('rejectAll() keeps only necessary=true', () => {
    const cm = createConsentManager();
    cm.rejectAll();
    const s = cm.state();
    expect(s.given).toBe(true);
    expect(s.categories.necessary).toBe(true);
    expect(s.categories.functional).toBe(false);
    expect(s.categories.analytics).toBe(false);
    expect(s.categories.marketing).toBe(false);
  });

  it('update() merges categories, necessary stays true', () => {
    const cm = createConsentManager();
    cm.update({ analytics: true, necessary: false }); // necessary override ignored
    expect(cm.hasCategory('analytics')).toBe(true);
    expect(cm.hasCategory('necessary')).toBe(true);
    expect(cm.hasCategory('marketing')).toBe(false);
  });

  it('given computed reflects consent state', () => {
    const cm = createConsentManager();
    expect(cm.given()).toBe(false);
    cm.acceptAll();
    expect(cm.given()).toBe(true);
  });

  it('withdraw() resets state and removes from storage', () => {
    const cm = createConsentManager();
    cm.acceptAll();
    cm.withdraw();
    expect(cm.state().given).toBe(false);
    expect(localStorageMock.getItem('drishti_consent')).toBeNull();
  });

  it('reset() clears state without calling onUpdate', () => {
    const onUpdate = vi.fn();
    const cm = createConsentManager({ onUpdate });
    cm.acceptAll();
    onUpdate.mockClear();
    cm.reset();
    expect(cm.state().given).toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('persists and reloads from localStorage', () => {
    const cm1 = createConsentManager({ storageKey: 'test_consent', version: '2' });
    cm1.acceptAll();
    const cm2 = createConsentManager({ storageKey: 'test_consent', version: '2' });
    expect(cm2.state().given).toBe(true);
    expect(cm2.hasCategory('analytics')).toBe(true);
  });

  it('version mismatch discards stored consent', () => {
    const cm1 = createConsentManager({ storageKey: 'ver_consent', version: '1' });
    cm1.acceptAll();
    const cm2 = createConsentManager({ storageKey: 'ver_consent', version: '2' });
    expect(cm2.state().given).toBe(false);
  });

  it('calls onUpdate after acceptAll', () => {
    const onUpdate = vi.fn();
    const cm = createConsentManager({ onUpdate });
    cm.acceptAll();
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate.mock.calls[0][0].given).toBe(true);
  });
});
