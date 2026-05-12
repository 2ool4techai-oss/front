import { describe, it, expect, vi } from 'vitest';
import { createPredictiveRouter } from '../predictive.js';

describe('createPredictiveRouter', () => {
  it('returns a PredictiveRouter with required methods', () => {
    const router = createPredictiveRouter();
    expect(typeof router.navigate).toBe('function');
    expect(typeof router.prefetch).toBe('function');
    expect(typeof router.currentRoute).toBe('function');
    expect(typeof router.predictions).toBe('function');
  });

  it('navigate changes current route', () => {
    const router = createPredictiveRouter();
    router.navigate('/home');
    expect(router.currentRoute()).toBe('/home');
  });

  it('records navigation history', () => {
    const router = createPredictiveRouter();
    router.navigate('/about');
    router.navigate('/products');
    router.navigate('/about');
  });

  it('predictions returns an array', () => {
    const router = createPredictiveRouter();
    router.navigate('/home');
    expect(Array.isArray(router.predictions())).toBe(true);
  });

  it('prefetch can be called without error', () => {
    const router = createPredictiveRouter();
    expect(() => router.prefetch('/contact')).not.toThrow();
  });

  it('onNavigate callback fires on navigate', () => {
    const spy = vi.fn();
    const router = createPredictiveRouter({ onNavigate: spy });
    router.navigate('/shop');
    expect(spy).toHaveBeenCalledWith('/shop');
  });
});
