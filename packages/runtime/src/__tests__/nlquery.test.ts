import { describe, it, expect, beforeEach } from 'vitest';
import { registerQueryable, getQueryRegistry, queryLocally, drQuery } from '../nlquery.js';
import { signal } from '../signal.js';

beforeEach(() => {
  getQueryRegistry().clear();
});

describe('registerQueryable', () => {
  it('adds signal to the registry', () => {
    const s = signal([1, 2, 3]);
    registerQueryable('items', s);
    expect(getQueryRegistry().has('items')).toBe(true);
  });

  it('stores optional schema', () => {
    const s = signal([]);
    const schema = { type: 'array', items: { type: 'number' } };
    registerQueryable('nums', s, schema);
    expect(getQueryRegistry().get('nums')?.schema).toEqual(schema);
  });
});

describe('queryLocally', () => {
  it('filters array by equality', () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    const result = queryLocally(data, "named Alice");
    expect(result).toHaveLength(1);
    expect((result[0] as any).name).toBe('Alice');
  });

  it('filters by numeric greater than', () => {
    const data = [{ price: 10 }, { price: 50 }, { price: 100 }];
    const result = queryLocally(data, 'price greater than 30');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r: any) => r.price > 30)).toBe(true);
  });

  it('returns all when no match can be parsed', () => {
    const data = [1, 2, 3];
    const result = queryLocally(data, 'ajksdhajkshd');
    expect(result).toEqual(data);
  });
});

describe('drQuery', () => {
  it('returns NLQueryResult with data, loading, error, refresh', () => {
    const s = signal([{ id: 1 }, { id: 2 }]);
    registerQueryable('things', s);
    const result = drQuery('get all things');
    expect(typeof result.data).toBe('function');
    expect(typeof result.loading).toBe('function');
    expect(typeof result.error).toBe('function');
    expect(typeof result.refresh).toBe('function');
  });

  it('returns data as an array', () => {
    const s = signal([{ v: 1 }, { v: 2 }]);
    registerQueryable('vals', s);
    const result = drQuery('get all vals');
    expect(Array.isArray(result.data())).toBe(true);
  });
});
