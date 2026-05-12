import { describe, it, expect, beforeEach } from 'vitest';
import { fromDesignTokens, injectDesignSystem, parseDesignSpec } from '../design.js';

beforeEach(() => {
  document.getElementById('dr-design-system')?.remove();
});

describe('fromDesignTokens', () => {
  it('converts tokens to CSS variable map with --dr- prefix', () => {
    const tokens = [
      { name: 'primary', value: '#6366f1', type: 'color' as const },
      { name: 'md',      value: '16px',    type: 'spacing' as const },
    ];
    const result = fromDesignTokens(tokens);
    expect(result['--dr-color-primary']).toBe('#6366f1');
    expect(result['--dr-spacing-md']).toBe('16px');
  });

  it('returns an empty object for an empty token array', () => {
    expect(fromDesignTokens([])).toEqual({});
  });

  it('uses cssVar override when provided', () => {
    const tokens = [{ name: 'brand', value: '#fff', type: 'color' as const, cssVar: '--my-brand' }];
    const result = fromDesignTokens(tokens);
    expect(result['--my-brand']).toBe('#fff');
  });

  it('handles all token types without throwing', () => {
    const tokens = [
      { name: 'base', value: '16px',      type: 'typography' as const },
      { name: 'sm',   value: '0 1px 2px', type: 'shadow' as const },
      { name: 'md',   value: '8px',        type: 'border' as const },
    ];
    expect(() => fromDesignTokens(tokens)).not.toThrow();
  });
});

describe('injectDesignSystem', () => {
  it('injects a <style id="dr-design-system"> element', () => {
    injectDesignSystem([{ name: 'blue', value: '#3b82f6', type: 'color' as const }]);
    const el = document.getElementById('dr-design-system');
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('#3b82f6');
  });

  it('updates the same style element on subsequent calls', () => {
    injectDesignSystem([{ name: 'a', value: 'red', type: 'color' as const }]);
    injectDesignSystem([{ name: 'b', value: 'blue', type: 'color' as const }]);
    const els = document.querySelectorAll('#dr-design-system');
    expect(els).toHaveLength(1);
    expect(els[0]!.textContent).toContain('blue');
  });

  it('does not throw for empty token list', () => {
    expect(() => injectDesignSystem([])).not.toThrow();
  });
});

describe('parseDesignSpec', () => {
  it('returns a DesignComponent with name, tokens, html, signals, code', () => {
    const result = parseDesignSpec({ name: 'Button' });
    expect(result).toHaveProperty('name', 'Button');
    expect(result).toHaveProperty('tokens');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('code');
  });

  it('falls back to "Component" when no name provided', () => {
    const result = parseDesignSpec({});
    expect(result.name).toBe('Component');
  });

  it('code field is a non-empty string', () => {
    const result = parseDesignSpec({ name: 'Card' });
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
  });

  it('signals is an array', () => {
    const result = parseDesignSpec({ name: 'Toggle' });
    expect(Array.isArray(result.signals)).toBe(true);
  });
});
