import { describe, it, expect, beforeEach } from 'vitest';
import {
  semanticSignal,
  describeAppState,
  getSemanticRegistry,
  _clearSemanticRegistry,
} from '../semantic.js';

beforeEach(() => {
  _clearSemanticRegistry();
});

describe('semanticSignal', () => {
  it('creates a signal with an initial value', () => {
    const price = semanticSignal(9.99, {
      description: 'Product price',
      unit: 'USD',
    });
    expect(price()).toBe(9.99);
    expect(price.peek()).toBe(9.99);
  });

  it('attaches meta to the signal', () => {
    const count = semanticSignal(0, {
      description: 'Cart item count',
      unit: 'count',
      tags: ['cart', 'ecommerce'],
      intent: 'business-metric',
      range: { min: 0, max: 999 },
    });
    expect(count.meta.description).toBe('Cart item count');
    expect(count.meta.unit).toBe('count');
    expect(count.meta.tags).toContain('cart');
    expect(count.meta.intent).toBe('business-metric');
    expect(count.meta.range?.min).toBe(0);
    expect(count.meta.range?.max).toBe(999);
  });

  it('has a unique id', () => {
    const a = semanticSignal('light', { description: 'Theme', enum: ['light', 'dark'] });
    const b = semanticSignal('dark',  { description: 'Mode', enum: ['light', 'dark'] });
    expect(a.id).not.toBe(b.id);
  });

  it('id is derived from description', () => {
    const sig = semanticSignal(42, { description: 'User Score' });
    expect(sig.id).toContain('user_score');
  });

  it('is a fully reactive signal — set/subscribe work', () => {
    const theme = semanticSignal<'light' | 'dark'>('light', { description: 'Theme' });
    theme.set('dark');
    expect(theme()).toBe('dark');
  });

  it('accepts enum meta', () => {
    const status = semanticSignal('active', {
      description: 'User status',
      enum: ['active', 'inactive', 'banned'],
    });
    expect(status.meta.enum).toEqual(['active', 'inactive', 'banned']);
  });
});

describe('getSemanticRegistry', () => {
  it('returns all registered semantic signals', () => {
    semanticSignal(100, { description: 'Revenue', unit: 'USD', intent: 'business-metric' });
    semanticSignal(50,  { description: 'Latency', unit: 'ms',  intent: 'business-metric' });

    const registry = getSemanticRegistry();
    expect(registry.size).toBe(2);
  });

  it('returns correct meta for each entry', () => {
    semanticSignal('open', { description: 'Modal open state', intent: 'ui-state' });
    const registry = getSemanticRegistry();

    const entry = Array.from(registry.values()).find(m => m.description === 'Modal open state');
    expect(entry).toBeDefined();
    expect(entry!.intent).toBe('ui-state');
  });

  it('is keyed by id', () => {
    const sig = semanticSignal(42, { description: 'Test Signal' });
    const registry = getSemanticRegistry();
    expect(registry.has(sig.id)).toBe(true);
  });
});

describe('describeAppState', () => {
  it('returns an object describing all registered signals', () => {
    semanticSignal(42,       { description: 'Score',   unit: 'count' });
    semanticSignal('Alice',  { description: 'Username', intent: 'user-preference' });

    const state = describeAppState() as Record<string, unknown>;
    const values = Object.values(state) as Array<Record<string, unknown>>;

    expect(values.some(v => v['value'] === 42)).toBe(true);
    expect(values.some(v => v['value'] === 'Alice')).toBe(true);
  });

  it('includes value + meta in each entry', () => {
    semanticSignal(0.95, { description: 'Conversion rate', unit: 'percent', tags: ['funnel'] });

    const state = describeAppState() as Record<string, Record<string, unknown>>;
    const entry = Object.values(state)[0]!;

    expect(entry['value']).toBe(0.95);
    expect(entry['unit']).toBe('percent');
    expect(entry['tags']).toContain('funnel');
    expect(entry['description']).toBe('Conversion rate');
  });

  it('returns empty object when no signals are registered', () => {
    const state = describeAppState();
    expect(Object.keys(state).length).toBe(0);
  });

  it('reflects latest signal values after mutation', () => {
    const score = semanticSignal(0, { description: 'Points' });
    score.set(100);

    const state = describeAppState() as Record<string, Record<string, unknown>>;
    const entry = Object.values(state).find(v => v['description'] === 'Points')!;
    expect(entry['value']).toBe(100);
  });
});
