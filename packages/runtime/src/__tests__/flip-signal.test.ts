// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createFlip } from '../flip-signal.js';

describe('createFlip', () => {
  it('creates a flip handle', () => {
    const el = document.createElement('div');
    const flip = createFlip(el);
    expect(typeof flip.first).toBe('function');
    expect(typeof flip.last).toBe('function');
    expect(typeof flip.play).toBe('function');
    expect(typeof flip.animate).toBe('function');
  });

  it('first() and last() do not throw', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const flip = createFlip(el);
    expect(() => flip.first()).not.toThrow();
    expect(() => flip.last()).not.toThrow();
    document.body.removeChild(el);
  });

  it('animate() calls the provided function', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const flip = createFlip(el);
    const fn = vi.fn();
    flip.animate(fn);
    expect(fn).toHaveBeenCalled();
    document.body.removeChild(el);
  });
});
