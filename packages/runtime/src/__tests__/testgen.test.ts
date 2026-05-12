import { describe, it, expect } from 'vitest';
import { generateTestsForComponent, generateSignalTests } from '../testgen.js';
import { signal } from '../signal.js';
import { h } from '../renderer.js';

describe('generateSignalTests', () => {
  it('returns an array of TestSpec objects', () => {
    const count = signal(0);
    const specs = generateSignalTests({ count });
    expect(Array.isArray(specs)).toBe(true);
    expect(specs.length).toBeGreaterThan(0);
  });

  it('each spec has name, fn, type fields', () => {
    const val = signal('hello');
    const specs = generateSignalTests({ val });
    for (const spec of specs) {
      expect(spec).toHaveProperty('name');
      expect(spec).toHaveProperty('fn');
      expect(spec).toHaveProperty('type');
    }
  });

  it('generated tests actually pass when run', () => {
    const count = signal(0);
    const specs = generateSignalTests({ count });
    for (const spec of specs) {
      expect(() => spec.fn()).not.toThrow();
    }
  });
});

describe('generateTestsForComponent', () => {
  it('returns specs for a simple component factory', () => {
    const factory = () => h('button', { onClick: () => {} }, 'Click me');
    const specs = generateTestsForComponent(factory);
    expect(Array.isArray(specs)).toBe(true);
  });

  it('generated component tests pass', () => {
    const factory = () => h('div', { style: { color: 'red' } }, 'Hello');
    const specs = generateTestsForComponent(factory);
    for (const spec of specs) {
      expect(() => spec.fn()).not.toThrow();
    }
  });
});
