import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInfiniteScroll } from '../InfiniteScroll.js';

let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
class MockIO {
  constructor(cb: (e: { isIntersecting: boolean }[]) => void) { ioCallback = cb; }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('IntersectionObserver', MockIO);

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeRenderItem() {
  return (item: string, _idx: number): HTMLElement => {
    const el = document.createElement('div');
    el.textContent = item;
    return el;
  };
}

beforeEach(() => {
  ioCallback = null;
});

describe('createInfiniteScroll', () => {
  it('mount() does not throw', () => {
    const container = document.createElement('div');
    const scroll = createInfiniteScroll({
      fetchMore: async () => [],
      renderItem: makeRenderItem(),
    });
    expect(() => scroll.mount(container)).not.toThrow();
  });

  it('items starts with initialItems', () => {
    const scroll = createInfiniteScroll({
      fetchMore: async () => [],
      renderItem: makeRenderItem(),
      initialItems: ['a', 'b', 'c'],
    });
    expect(scroll.items()).toEqual(['a', 'b', 'c']);
  });

  it('loading starts false', () => {
    const scroll = createInfiniteScroll({
      fetchMore: async () => [],
      renderItem: makeRenderItem(),
    });
    expect(scroll.loading()).toBe(false);
  });

  it('hasMore starts true', () => {
    const scroll = createInfiniteScroll({
      fetchMore: async () => [],
      renderItem: makeRenderItem(),
    });
    expect(scroll.hasMore()).toBe(true);
  });

  it('reset() clears items signal', () => {
    const scroll = createInfiniteScroll({
      fetchMore: async () => [],
      renderItem: makeRenderItem(),
      initialItems: ['x', 'y'],
    });
    scroll.reset();
    expect(scroll.items()).toEqual([]);
  });

  it('prepend() adds to front of items', () => {
    const scroll = createInfiniteScroll({
      fetchMore: async () => [],
      renderItem: makeRenderItem(),
      initialItems: ['c', 'd'],
    });
    scroll.prepend(['a', 'b']);
    expect(scroll.items()[0]).toBe('a');
    expect(scroll.items()[1]).toBe('b');
    expect(scroll.items()[2]).toBe('c');
  });

  it('destroy() does not throw', () => {
    const container = document.createElement('div');
    const scroll = createInfiniteScroll({
      fetchMore: async () => [],
      renderItem: makeRenderItem(),
    });
    scroll.mount(container);
    expect(() => scroll.destroy()).not.toThrow();
  });

  it('fetchMore called when IO triggers', async () => {
    const fetchMore = vi.fn().mockResolvedValue(['item1', 'item2']);
    const container = document.createElement('div');
    const scroll = createInfiniteScroll({
      fetchMore,
      renderItem: makeRenderItem(),
    });
    scroll.mount(container);
    expect(ioCallback).not.toBeNull();
    ioCallback!([{ isIntersecting: true }]);
    await flush();
    expect(fetchMore).toHaveBeenCalledOnce();
  });
});
