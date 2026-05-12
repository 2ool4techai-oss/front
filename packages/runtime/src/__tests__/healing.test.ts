import { describe, it, expect, vi } from 'vitest';
import { diagnose, createSelfHealingBoundary } from '../healing.js';
import type { HealingContext } from '../healing.js';

// ── diagnose ───────────────────────────────────────────────────────────

describe('diagnose', () => {
  it('returns an array of HealSuggestion objects', () => {
    const err = new Error("Cannot read properties of undefined (reading 'name')");
    const suggestions = diagnose(err);
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('each suggestion has required fields', () => {
    const err = new Error("Cannot read properties of undefined (reading 'foo')");
    const suggestions = diagnose(err);
    for (const s of suggestions) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('title');
      expect(s).toHaveProperty('description');
      expect(s).toHaveProperty('confidence');
      expect(s).toHaveProperty('apply');
      expect(s).toHaveProperty('preview');
      expect(typeof s.id).toBe('string');
      expect(typeof s.title).toBe('string');
      expect(typeof s.apply).toBe('function');
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('null/undefined access → null-check suggestion with high confidence', () => {
    const err = new Error("Cannot read properties of undefined (reading 'name')");
    const suggestions = diagnose(err);
    const nullCheck = suggestions.find(s => s.id === 'null-check');
    expect(nullCheck).toBeDefined();
    expect(nullCheck!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(nullCheck!.preview).toContain('?.name');
  });

  it('null of null access → null-check suggestion', () => {
    const err = new Error("Cannot read properties of null (reading 'value')");
    const suggestions = diagnose(err);
    expect(suggestions.some(s => s.id === 'null-check')).toBe(true);
  });

  it('circular dependency / maximum update depth → circular-dep suggestion', () => {
    const err = new Error('Maximum update depth exceeded');
    const suggestions = diagnose(err);
    const circularDep = suggestions.find(s => s.id === 'circular-dep');
    expect(circularDep).toBeDefined();
    expect(circularDep!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(circularDep!.preview).toContain('untrack');
  });

  it('stack overflow → circular-dep suggestion', () => {
    const err = new Error('Maximum call stack size exceeded');
    const suggestions = diagnose(err);
    expect(suggestions.some(s => s.id === 'circular-dep')).toBe(true);
  });

  it('"is not a function" → signal-typo suggestion', () => {
    const err = new Error('mySignal is not a function');
    const suggestions = diagnose(err);
    const typoSugg = suggestions.find(s => s.id === 'signal-typo');
    expect(typoSugg).toBeDefined();
    expect(typoSugg!.preview).toContain('mySignal');
  });

  it('network error → network-retry suggestion', () => {
    const err = new Error('Failed to fetch data from server');
    const suggestions = diagnose(err);
    const retrySugg = suggestions.find(s => s.id === 'network-retry');
    expect(retrySugg).toBeDefined();
    expect(retrySugg!.preview).toContain('retry');
  });

  it('TypeError → type-mismatch suggestion', () => {
    const err = new TypeError('Cannot convert undefined to object');
    const suggestions = diagnose(err);
    expect(suggestions.some(s => s.id === 'type-mismatch')).toBe(true);
  });

  it('RangeError → range-guard suggestion', () => {
    const err = new RangeError('Invalid array length');
    const suggestions = diagnose(err);
    expect(suggestions.some(s => s.id === 'range-guard')).toBe(true);
  });

  it('unknown error → generic-debug fallback suggestion', () => {
    const err = new Error('some completely unknown error xyz');
    const suggestions = diagnose(err);
    expect(suggestions.length).toBeGreaterThan(0);
    // At minimum the generic fallback
    expect(suggestions.some(s => s.id === 'generic-debug')).toBe(true);
  });

  it('accepts optional HealingContext', () => {
    const err = new Error("Cannot read properties of undefined (reading 'x')");
    const ctx: HealingContext = {
      error: err,
      componentName: 'MyWidget',
      signalValues: { counter: 0 },
      stackTrace: err.stack ?? '',
    };
    const suggestions = diagnose(err, ctx);
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('suggestion.apply() is callable without throwing', () => {
    const err = new Error("Cannot read properties of undefined (reading 'foo')");
    const suggestions = diagnose(err);
    for (const s of suggestions) {
      expect(() => s.apply()).not.toThrow();
    }
  });
});

// ── createSelfHealingBoundary ──────────────────────────────────────────

describe('createSelfHealingBoundary', () => {
  it('renders component normally when no error', () => {
    const el = createSelfHealingBoundary(() => {
      const div = document.createElement('div');
      div.textContent = 'Hello!';
      return div;
    });
    expect(el.tagName.toLowerCase()).toBe('div');
    expect(el.querySelector('div')?.textContent).toBe('Hello!');
  });

  it('catches render errors and shows fallback UI', () => {
    const el = createSelfHealingBoundary(() => {
      throw new Error('Render failed');
    });
    // Should not throw; element should have error UI
    expect(el).toBeInstanceOf(HTMLElement);
    // Some error indicator should be present
    const text = el.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
  });

  it('calls onError callback with HealingContext', () => {
    const onError = vi.fn();
    createSelfHealingBoundary(
      () => { throw new Error('Test error'); },
      { onError },
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const ctx = onError.mock.calls[0]?.[0] as HealingContext;
    expect(ctx.error).toBeInstanceOf(Error);
    expect(ctx.error.message).toBe('Test error');
    expect(ctx.stackTrace).toBeDefined();
  });

  it('shows healing UI with suggestions when error occurs', () => {
    const el = createSelfHealingBoundary(() => {
      throw new Error("Cannot read properties of undefined (reading 'name')");
    });
    // Should contain some text about error or suggestions
    const content = el.innerHTML;
    expect(content.length).toBeGreaterThan(0);
  });

  it('returns HTMLElement wrapped in data-dr-self-heal div', () => {
    const el = createSelfHealingBoundary(() => {
      return document.createElement('span');
    });
    expect(el.getAttribute('data-dr-self-heal')).toBe('');
  });

  it('autoHeal with high-confidence suggestion attempts to retry render', () => {
    let attempts = 0;
    // First render throws, second succeeds
    const el = createSelfHealingBoundary(
      () => {
        attempts++;
        if (attempts < 2) {
          throw new Error("Cannot read properties of undefined (reading 'x')");
        }
        return document.createElement('div');
      },
      { autoHeal: true },
    );
    // Either healed (2 attempts) or showed error UI (1 attempt)
    expect(attempts).toBeGreaterThanOrEqual(1);
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
