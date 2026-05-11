import { describe, it, expect } from 'vitest';
import {
  getDrishtiTheme,
  getDrishtiContentGlobs,
  drishtiTailwindPlugin,
} from '../index.js';

describe('getDrishtiTheme', () => {
  it('returns object with colors', () => {
    const theme = getDrishtiTheme();
    expect(theme).toHaveProperty('colors');
  });

  it('colors.primary contains var(--dr-color-primary', () => {
    const theme = getDrishtiTheme();
    expect(theme.colors['primary']).toContain('var(--dr-color-primary');
  });

  it('fontFamily.dr is an array', () => {
    const theme = getDrishtiTheme();
    expect(Array.isArray(theme.fontFamily['dr'])).toBe(true);
  });

  it("spacing has 'dr-md'", () => {
    const theme = getDrishtiTheme();
    expect(theme.spacing).toHaveProperty('dr-md');
  });

  it("borderRadius has 'dr-lg'", () => {
    const theme = getDrishtiTheme();
    expect(theme.borderRadius).toHaveProperty('dr-lg');
  });
});

describe('getDrishtiContentGlobs', () => {
  it('returns an array', () => {
    const globs = getDrishtiContentGlobs();
    expect(Array.isArray(globs)).toBe(true);
  });

  it('includes a .dr glob', () => {
    const globs = getDrishtiContentGlobs();
    expect(globs.some((g) => g.endsWith('.dr'))).toBe(true);
  });
});

describe('drishtiTailwindPlugin', () => {
  it('returns object with handler', () => {
    const plugin = drishtiTailwindPlugin();
    expect(plugin).toHaveProperty('handler');
  });

  it('handler is a function', () => {
    const plugin = drishtiTailwindPlugin();
    expect(typeof plugin.handler).toBe('function');
  });

  it('config has theme.extend', () => {
    const plugin = drishtiTailwindPlugin();
    const config = plugin.config as Record<string, unknown>;
    expect(config).toHaveProperty('theme');
    const theme = config['theme'] as Record<string, unknown>;
    expect(theme).toHaveProperty('extend');
  });
});
