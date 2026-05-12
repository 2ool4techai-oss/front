import { describe, it, expect, vi, beforeEach } from 'vitest';
import { boundedSignal } from '../bounded-signal.js';

describe('boundedSignal — initialization', () => {
  it('holds an initial array value', () => {
    const s = boundedSignal([1, 2, 3], { maxSize: 5 });
    expect(s()).toEqual([1, 2, 3]);
  });

  it('capacity() returns maxSize', () => {
    const s = boundedSignal([], { maxSize: 10 });
    expect(s.capacity()).toBe(10);
  });

  it('size() returns current array length', () => {
    const s = boundedSignal([1, 2, 3], { maxSize: 10 });
    expect(s.size()).toBe(3);
  });

  it('isFull() is false when below capacity', () => {
    const s = boundedSignal([1, 2], { maxSize: 5 });
    expect(s.isFull()).toBe(false);
  });

  it('isFull() is true when at capacity', () => {
    const s = boundedSignal([1, 2, 3], { maxSize: 3 });
    expect(s.isFull()).toBe(true);
  });

  it('trims initial array that exceeds maxSize using default strategy (drop-oldest)', () => {
    const s = boundedSignal([1, 2, 3, 4, 5], { maxSize: 3 });
    expect(s()).toEqual([3, 4, 5]);
  });

  it('throws RangeError if maxSize < 1', () => {
    expect(() => boundedSignal([], { maxSize: 0 })).toThrow(RangeError);
  });
});

describe('boundedSignal — set() with drop-oldest strategy', () => {
  it('accepts arrays within bounds without dropping', () => {
    const s = boundedSignal<number>([], { maxSize: 5, strategy: 'drop-oldest' });
    s.set([1, 2, 3]);
    expect(s()).toEqual([1, 2, 3]);
  });

  it('drops oldest items when exceeding maxSize', () => {
    const s = boundedSignal<number>([], { maxSize: 3, strategy: 'drop-oldest' });
    s.set([1, 2, 3, 4, 5]);
    expect(s()).toEqual([3, 4, 5]);
  });

  it('calls onBound with dropped and current arrays', () => {
    const onBound = vi.fn();
    const s = boundedSignal<number>([], { maxSize: 2, strategy: 'drop-oldest', onBound });
    s.set([10, 20, 30, 40]);
    expect(onBound).toHaveBeenCalledWith([10, 20], [30, 40]);
  });

  it('does not call onBound when no items are dropped', () => {
    const onBound = vi.fn();
    const s = boundedSignal<number>([], { maxSize: 5, onBound });
    s.set([1, 2]);
    expect(onBound).not.toHaveBeenCalled();
  });
});

describe('boundedSignal — set() with drop-newest strategy', () => {
  it('keeps first maxSize items, discards overflow', () => {
    const s = boundedSignal<number>([], { maxSize: 3, strategy: 'drop-newest' });
    s.set([1, 2, 3, 4, 5]);
    expect(s()).toEqual([1, 2, 3]);
  });

  it('calls onBound with dropped tail and kept head', () => {
    const onBound = vi.fn();
    const s = boundedSignal<number>([], { maxSize: 2, strategy: 'drop-newest', onBound });
    s.set([10, 20, 30, 40]);
    expect(onBound).toHaveBeenCalledWith([30, 40], [10, 20]);
  });
});

describe('boundedSignal — set() with throw strategy', () => {
  it('throws RangeError when array exceeds maxSize', () => {
    const s = boundedSignal<number>([], { maxSize: 2, strategy: 'throw' });
    expect(() => s.set([1, 2, 3])).toThrow(RangeError);
  });

  it('does not throw when array is within bounds', () => {
    const s = boundedSignal<number>([], { maxSize: 5, strategy: 'throw' });
    expect(() => s.set([1, 2, 3])).not.toThrow();
    expect(s()).toEqual([1, 2, 3]);
  });
});

describe('boundedSignal — push()', () => {
  it('appends items to the signal array', () => {
    const s = boundedSignal([1, 2], { maxSize: 10 });
    s.push(3, 4);
    expect(s()).toEqual([1, 2, 3, 4]);
  });

  it('respects bound when pushing beyond maxSize (drop-oldest)', () => {
    const s = boundedSignal([1, 2, 3], { maxSize: 3, strategy: 'drop-oldest' });
    s.push(4, 5);
    expect(s()).toEqual([3, 4, 5]);
  });

  it('respects bound when pushing beyond maxSize (drop-newest)', () => {
    const s = boundedSignal([1, 2, 3], { maxSize: 3, strategy: 'drop-newest' });
    s.push(4, 5);
    expect(s()).toEqual([1, 2, 3]);
  });

  it('size() updates after push', () => {
    const s = boundedSignal([1], { maxSize: 5 });
    s.push(2, 3);
    expect(s.size()).toBe(3);
  });

  it('isFull() becomes true after push fills capacity', () => {
    const s = boundedSignal([1, 2], { maxSize: 3 });
    s.push(3);
    expect(s.isFull()).toBe(true);
  });
});

describe('boundedSignal — peek()', () => {
  it('returns current array without side effects', () => {
    const s = boundedSignal([1, 2, 3], { maxSize: 5 });
    expect(s.peek()).toEqual([1, 2, 3]);
    s.set([4, 5]);
    expect(s.peek()).toEqual([4, 5]);
  });
});

describe('boundedSignal — warn on drop', () => {
  it('warns to console when items are dropped', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = boundedSignal<number>([], { maxSize: 2, strategy: 'drop-oldest' });
    s.set([1, 2, 3]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not warn when no items are dropped', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = boundedSignal<number>([], { maxSize: 5 });
    s.set([1, 2]);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
