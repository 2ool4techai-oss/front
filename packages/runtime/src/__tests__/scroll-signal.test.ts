// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { windowScrollSignal, scrollProgressSignal } from '../scroll-signal.js';

describe('windowScrollSignal', () => {
  it('returns reactive scrollY', () => {
    const s = windowScrollSignal();
    expect(typeof s.scrollY()).toBe('number');
  });

  it('direction starts as none', () => {
    const s = windowScrollSignal();
    expect(s.direction()).toBe('none');
  });
});

describe('scrollProgressSignal', () => {
  it('creates without error', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const s = scrollProgressSignal(el);
    expect(typeof s.progress()).toBe('number');
    s.stop();
    document.body.removeChild(el);
  });
});
