import { describe, it, expect } from 'vitest';
import { signal, computed } from '@drishti/runtime';
import { expectSignal, setupSignalMatchers } from '../assertions.js';

describe('expectSignal', () => {
  it('toHaveValue passes when signal matches', () => {
    const sig = signal(42);
    expect(() => expectSignal(sig).toHaveValue(42)).not.toThrow();
  });

  it('toHaveValue throws when does not match', () => {
    const sig = signal(1);
    expect(() => expectSignal(sig).toHaveValue(99)).toThrow();
  });

  it('not.toHaveValue passes when signal does not match', () => {
    const sig = signal(1);
    expect(() => expectSignal(sig).not.toHaveValue(99)).not.toThrow();
  });

  it('not.toHaveValue throws when it does match', () => {
    const sig = signal(42);
    expect(() => expectSignal(sig).not.toHaveValue(42)).toThrow();
  });

  it('setupSignalMatchers() does not throw', () => {
    expect(() => setupSignalMatchers()).not.toThrow();
  });

  it('expectSignal works with computed signals', () => {
    const a = signal(10);
    const b = computed(() => a() * 2);
    expectSignal(b).toHaveValue(20);
    a.set(5);
    expectSignal(b).toHaveValue(10);
  });
});
