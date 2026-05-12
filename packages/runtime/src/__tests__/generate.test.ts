import { describe, it, expect } from 'vitest';
import { generate, generateSync } from '../generate.js';

describe('generateSync', () => {
  it('returns a counter component for "counter" description', () => {
    const result = generateSync('a simple counter');
    expect(result.signals).toContain('count');
    expect(result.description).toBe('a simple counter');
    expect(typeof result.code).toBe('string');
    const el = result.component();
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('returns a todo component for "todo list" description', () => {
    const result = generateSync('build a todo list');
    expect(result.signals).toContain('items');
    const el = result.component();
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('returns a form component for "form with name and email"', () => {
    const result = generateSync('form with name and email fields');
    const el = result.component();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName.toLowerCase()).toBe('form');
  });

  it('returns a toggle component for "toggle switch"', () => {
    const result = generateSync('a toggle switch');
    expect(result.signals).toContain('on');
    const el = result.component();
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('returns a slider component for "range slider"', () => {
    const result = generateSync('range slider from 0 to 100');
    expect(result.signals).toContain('value');
    const el = result.component();
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('returns a generic card for unknown descriptions', () => {
    const result = generateSync('something completely unknown xyz123');
    expect(result.description).toBe('something completely unknown xyz123');
    const el = result.component();
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('result has code, component, signals, description fields', () => {
    const result = generateSync('counter');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('component');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('description');
    expect(Array.isArray(result.signals)).toBe(true);
  });
});

describe('generate (async)', () => {
  it('falls back to sync when no apiKey provided', async () => {
    const result = await generate('a counter');
    expect(result.signals).toContain('count');
    const el = result.component();
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('falls back to sync on fetch failure', async () => {
    const result = await generate('todo list', { apiKey: 'invalid-key-will-fail' });
    expect(result.signals).toContain('items');
  });
});
