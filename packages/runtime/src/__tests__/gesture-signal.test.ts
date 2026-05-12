// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { gestureSignal } from '../gesture-signal.js';

describe('gestureSignal', () => {
  it('starts with dragging=false', () => {
    const g = gestureSignal();
    expect(g.isDragging()).toBe(false);
  });

  it('bind returns an unbind function', () => {
    const g = gestureSignal();
    const el = document.createElement('div');
    const unbind = g.bind(el);
    expect(typeof unbind).toBe('function');
    unbind(); // should not throw
  });

  it('state has correct initial values', () => {
    const g = gestureSignal();
    const s = g.state();
    expect(s.dragging).toBe(false);
    expect(s.x).toBe(0);
    expect(s.dx).toBe(0);
  });
});
