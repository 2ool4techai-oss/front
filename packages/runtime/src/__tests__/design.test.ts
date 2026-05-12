import { describe, it, expect, beforeEach } from 'vitest';
import { fromDesignTokens, parseDesignSpec, injectDesignSystem } from '../design.js';
import type { DesignToken } from '../design.js';

const colorTokens: DesignToken[] = [
  { type: 'color',   name: 'Primary',    value: '#3b82f6', cssVar: '--dr-color-primary' },
  { type: 'color',   name: 'Background', value: '#0f172a', cssVar: '--dr-color-bg' },
];

const spacingTokens: DesignToken[] = [
  { type: 'spacing', name: 'sm',  value: '8px',  cssVar: '--dr-spacing-sm' },
  { type: 'spacing', name: 'md',  value: '16px', cssVar: '--dr-spacing-md' },
  { type: 'spacing', name: 'lg',  value: '32px', cssVar: '--dr-spacing-lg' },
];

const mixedTokens: DesignToken[] = [
  ...colorTokens,
  ...spacingTokens,
  { type: 'typography', name: 'Base font size', value: '16px' },
  { type: 'border',     name: 'Radius md',      value: '8px' },
  { type: 'shadow',     name: 'Card',            value: '0 2px 8px rgba(0,0,0,0.15)' },
];

// ── fromDesignTokens ────────────────────────────────────────────────────

describe('fromDesignTokens', () => {
  it('converts tokens to CSS custom property map', () => {
    const cssVars = fromDesignTokens(colorTokens);
    expect(cssVars['--dr-color-primary']).toBe('#3b82f6');
    expect(cssVars['--dr-color-bg']).toBe('#0f172a');
  });

  it('uses provided cssVar name', () => {
    const tokens: DesignToken[] = [
      { type: 'color', name: 'Brand', value: '#ff0000', cssVar: '--brand-primary' },
    ];
    const cssVars = fromDesignTokens(tokens);
    expect(cssVars['--brand-primary']).toBe('#ff0000');
  });

  it('auto-generates cssVar from type+name when not provided', () => {
    const tokens: DesignToken[] = [
      { type: 'spacing', name: 'Extra Large', value: '48px' },
    ];
    const cssVars = fromDesignTokens(tokens);
    const key = Object.keys(cssVars)[0]!;
    expect(key).toMatch(/^--dr-spacing/);
    expect(cssVars[key]).toBe('48px');
  });

  it('handles all token types', () => {
    const cssVars = fromDesignTokens(mixedTokens);
    expect(Object.keys(cssVars).length).toBe(mixedTokens.length);
  });

  it('returns empty object for empty array', () => {
    const cssVars = fromDesignTokens([]);
    expect(Object.keys(cssVars).length).toBe(0);
  });

  it('values are preserved exactly', () => {
    const tokens: DesignToken[] = [
      { type: 'shadow', name: 'Depth', value: '0 4px 16px rgba(0,0,0,0.25)', cssVar: '--shadow-depth' },
    ];
    const cssVars = fromDesignTokens(tokens);
    expect(cssVars['--shadow-depth']).toBe('0 4px 16px rgba(0,0,0,0.25)');
  });
});

// ── injectDesignSystem ──────────────────────────────────────────────────

describe('injectDesignSystem', () => {
  beforeEach(() => {
    // Remove any injected style
    document.getElementById('dr-design-system')?.remove();
  });

  it('injects a <style> tag into document.head', () => {
    injectDesignSystem(colorTokens);
    const style = document.getElementById('dr-design-system');
    expect(style).not.toBeNull();
    expect(style!.tagName).toBe('STYLE');
  });

  it('injected style contains :root block', () => {
    injectDesignSystem(colorTokens);
    const style = document.getElementById('dr-design-system') as HTMLStyleElement;
    expect(style.textContent).toContain(':root');
  });

  it('injected style contains all CSS variables', () => {
    injectDesignSystem(mixedTokens);
    const style = document.getElementById('dr-design-system') as HTMLStyleElement;
    const css = style.textContent!;
    for (const token of mixedTokens) {
      expect(css).toContain(token.value);
    }
  });

  it('updates existing style on re-inject (no duplicate tags)', () => {
    injectDesignSystem(colorTokens);
    injectDesignSystem(spacingTokens);
    const styles = document.querySelectorAll('#dr-design-system');
    expect(styles.length).toBe(1);
    // Should now contain spacing vars (was updated)
    const style = styles[0] as HTMLStyleElement;
    expect(style.textContent).toContain('--dr-spacing');
  });
});

// ── parseDesignSpec ─────────────────────────────────────────────────────

describe('parseDesignSpec', () => {
  it('returns a DesignComponent with required fields', () => {
    const comp = parseDesignSpec({ name: 'MyButton' });
    expect(typeof comp.name).toBe('string');
    expect(Array.isArray(comp.tokens)).toBe(true);
    expect(typeof comp.html).toBe('string');
    expect(Array.isArray(comp.signals)).toBe(true);
    expect(typeof comp.code).toBe('string');
  });

  it('uses spec name as component name', () => {
    const comp = parseDesignSpec({ name: 'CheckoutCard' });
    expect(comp.name).toBe('CheckoutCard');
  });

  it('extracts color tokens from fills', () => {
    const spec = {
      name: 'PrimaryButton',
      fills: [{ color: { r: 0.23, g: 0.51, b: 0.96 } }],
    };
    const comp = parseDesignSpec(spec);
    const colorToken = comp.tokens.find(t => t.type === 'color');
    expect(colorToken).toBeDefined();
    expect(colorToken!.value).toMatch(/^#/);
  });

  it('extracts spacing tokens from padding', () => {
    const spec = {
      name: 'Card',
      paddingTop: 16,
      itemSpacing: 8,
    };
    const comp = parseDesignSpec(spec);
    const spacingTokens = comp.tokens.filter(t => t.type === 'spacing');
    expect(spacingTokens.length).toBeGreaterThan(0);
    expect(spacingTokens.some(t => t.value === '16px')).toBe(true);
  });

  it('extracts typography tokens from fontSize', () => {
    const spec = { name: 'Heading', fontSize: 24, fontFamily: 'Inter' };
    const comp = parseDesignSpec(spec);
    const fontSizeToken = comp.tokens.find(t => t.type === 'typography' && t.value === '24px');
    expect(fontSizeToken).toBeDefined();
  });

  it('extracts border radius token', () => {
    const spec = { name: 'Card', cornerRadius: 12 };
    const comp = parseDesignSpec(spec);
    const border = comp.tokens.find(t => t.type === 'border');
    expect(border).toBeDefined();
    expect(border!.value).toBe('12px');
  });

  it('infers button component type for "Button" name', () => {
    const comp = parseDesignSpec({ name: 'PrimaryButton' });
    expect(comp.html).toContain('button');
    expect(comp.signals).toContain('isDisabled');
  });

  it('infers card component type for "Card" name', () => {
    const comp = parseDesignSpec({ name: 'ProductCard' });
    expect(comp.html).toContain('article');
    expect(comp.signals).toContain('title');
  });

  it('infers form component type', () => {
    const comp = parseDesignSpec({ name: 'LoginForm' });
    expect(comp.html).toContain('form');
    expect(comp.signals).toContain('isSubmitting');
  });

  it('generated code imports from @drishti/runtime', () => {
    const comp = parseDesignSpec({ name: 'Widget' });
    expect(comp.code).toContain('@drishti/runtime');
  });

  it('generated code includes signal declarations', () => {
    const comp = parseDesignSpec({ name: 'MyWidget' });
    expect(comp.code).toContain('signal');
  });

  it('handles unnamed spec gracefully', () => {
    const comp = parseDesignSpec({});
    expect(comp.name).toBe('Component');
    expect(typeof comp.html).toBe('string');
  });

  it('recursively extracts tokens from children', () => {
    const spec = {
      name: 'Container',
      children: [
        {
          name: 'Inner',
          fills: [{ color: { r: 1, g: 0, b: 0 } }],
        },
      ],
    };
    const comp = parseDesignSpec(spec);
    expect(comp.tokens.some(t => t.type === 'color')).toBe(true);
  });

  it('extracts shadow effects', () => {
    const spec = {
      name: 'ElevatedCard',
      effects: [
        {
          type: 'DROP_SHADOW',
          radius: 8,
          color: { r: 0, g: 0, b: 0, a: 0.2 },
        },
      ],
    };
    const comp = parseDesignSpec(spec);
    const shadowToken = comp.tokens.find(t => t.type === 'shadow');
    expect(shadowToken).toBeDefined();
    expect(shadowToken!.value).toContain('rgba');
  });
});
