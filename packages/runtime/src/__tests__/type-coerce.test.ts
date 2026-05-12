import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coercedSignal } from '../type-coerce.js';

describe('coercedSignal — string target', () => {
  it('holds a string initial value without coercion', () => {
    const s = coercedSignal('hello', { target: 'string' });
    expect(s()).toBe('hello');
    expect(s.coercionCount()).toBe(0);
    expect(s.lastCoercion()).toBeNull();
  });

  it('coerces a number to string', () => {
    const s = coercedSignal('', { target: 'string' });
    s.set(42);
    expect(s()).toBe('42');
    expect(s.coercionCount()).toBe(1);
    expect(s.lastCoercion()?.method).toBe('String()');
  });

  it('uses fallback for null input', () => {
    const s = coercedSignal('default', { target: 'string', fallback: 'default' });
    s.set(null);
    expect(s()).toBe('default');
  });

  it('uses empty string for null with no fallback', () => {
    const s = coercedSignal('x', { target: 'string' });
    s.set(null);
    expect(s()).toBe('');
  });
});

describe('coercedSignal — number target', () => {
  it('holds a number initial value without coercion', () => {
    const s = coercedSignal(5, { target: 'number' });
    expect(s()).toBe(5);
    expect(s.coercionCount()).toBe(0);
  });

  it('coerces a numeric string to number', () => {
    const s = coercedSignal(0, { target: 'number' });
    s.set('99');
    expect(s()).toBe(99);
    expect(s.coercionCount()).toBe(1);
    expect(s.lastCoercion()?.method).toBe('Number()');
  });

  it('falls back to 0 when coercion yields NaN', () => {
    const s = coercedSignal(0, { target: 'number' });
    s.set('not-a-number');
    expect(s()).toBe(0);
    expect(s.lastCoercion()?.method).toBe('fallback');
  });

  it('uses provided fallback when coercion yields NaN', () => {
    const s = coercedSignal(0, { target: 'number', fallback: -1 });
    s.set('bad');
    expect(s()).toBe(-1);
  });
});

describe('coercedSignal — boolean target', () => {
  it('holds a boolean initial value without coercion', () => {
    const s = coercedSignal(false, { target: 'boolean' });
    expect(s()).toBe(false);
    expect(s.coercionCount()).toBe(0);
  });

  it('parses "true" string to boolean true', () => {
    const s = coercedSignal(false, { target: 'boolean' });
    s.set('true');
    expect(s()).toBe(true);
    expect(s.lastCoercion()?.method).toBe('string-parse');
  });

  it('parses "false" string to boolean false', () => {
    const s = coercedSignal(true, { target: 'boolean' });
    s.set('false');
    expect(s()).toBe(false);
    expect(s.lastCoercion()?.method).toBe('string-parse');
  });

  it('coerces truthy values via Boolean()', () => {
    const s = coercedSignal(false, { target: 'boolean' });
    s.set(1);
    expect(s()).toBe(true);
    expect(s.lastCoercion()?.method).toBe('Boolean()');
  });
});

describe('coercedSignal — array target', () => {
  it('holds an array initial value without coercion', () => {
    const s = coercedSignal<unknown[]>([1, 2], { target: 'array' });
    expect(s()).toEqual([1, 2]);
    expect(s.coercionCount()).toBe(0);
  });

  it('wraps a non-array value in an array', () => {
    const s = coercedSignal<unknown[]>([], { target: 'array' });
    s.set('hello');
    expect(s()).toEqual(['hello']);
    expect(s.lastCoercion()?.method).toBe('wrap-in-array');
  });
});

describe('coercedSignal — object target', () => {
  it('holds an object initial value without coercion', () => {
    const s = coercedSignal<Record<string, unknown>>({ a: 1 }, { target: 'object' });
    expect(s()).toEqual({ a: 1 });
    expect(s.coercionCount()).toBe(0);
  });

  it('parses a JSON string to object', () => {
    const s = coercedSignal<Record<string, unknown>>({}, { target: 'object' });
    s.set('{"x":10}');
    expect(s()).toEqual({ x: 10 });
    expect(s.lastCoercion()?.method).toBe('JSON.parse()');
  });

  it('falls back to empty object when JSON parse fails', () => {
    const s = coercedSignal<Record<string, unknown>>({}, { target: 'object' });
    s.set('not-json');
    expect(s()).toEqual({});
    expect(s.lastCoercion()?.method).toBe('empty-object');
  });

  it('uses provided fallback when coercion is impossible', () => {
    const fallback = { default: true };
    const s = coercedSignal<Record<string, unknown>>({}, { target: 'object', fallback });
    s.set('not-json');
    expect(s()).toEqual({ default: true });
  });
});

describe('coercedSignal — hooks and strict mode', () => {
  it('calls onCoerce hook when coercion happens', () => {
    const onCoerce = vi.fn();
    const s = coercedSignal(0, { target: 'number', onCoerce });
    s.set('7');
    expect(onCoerce).toHaveBeenCalledWith('7', 7, 'Number()');
  });

  it('does not call onCoerce when value already correct type', () => {
    const onCoerce = vi.fn();
    const s = coercedSignal(0, { target: 'number', onCoerce });
    s.set(7);
    expect(onCoerce).not.toHaveBeenCalled();
  });

  it('throws in strict mode instead of warning', () => {
    const s = coercedSignal(0, { target: 'number', strict: true });
    expect(() => s.set('bad')).toThrow(TypeError);
  });

  it('tracks coercionCount across multiple sets', () => {
    const s = coercedSignal(0, { target: 'number' });
    s.set('1');
    s.set('2');
    s.set(3); // no coercion
    s.set('4');
    expect(s.coercionCount()).toBe(3);
  });

  it('peek() returns current value without side effects', () => {
    const s = coercedSignal(42, { target: 'number' });
    expect(s.peek()).toBe(42);
    s.set(99);
    expect(s.peek()).toBe(99);
  });

  it('warns to console when coercion happens', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = coercedSignal(0, { target: 'number' });
    s.set('5');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
