import { describe, it, expect } from 'vitest';
import { createVirtualList } from '../VirtualList.js';

function makeItems(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Item ${i}`);
}

function renderItem(item: string, _idx: number): HTMLElement {
  const el = document.createElement('div');
  el.textContent = item;
  return el;
}

describe('createVirtualList', () => {
  it('createVirtualList mounts to container', () => {
    const container = document.createElement('div');
    const list = createVirtualList({
      items:           makeItems(100),
      itemHeight:      40,
      containerHeight: 400,
      renderItem,
    });
    list.mount(container);
    expect(container.firstChild).toBeTruthy();
  });

  it('visibleRange signal initialized', () => {
    const list = createVirtualList({
      items:           makeItems(100),
      itemHeight:      40,
      containerHeight: 400,
      renderItem,
    });
    const range = list.visibleRange();
    expect(range.start).toBeGreaterThanOrEqual(0);
    expect(range.end).toBeGreaterThan(range.start);
  });

  it('updateItems() does not throw', () => {
    const container = document.createElement('div');
    const list = createVirtualList({
      items:           makeItems(50),
      itemHeight:      40,
      containerHeight: 400,
      renderItem,
    });
    list.mount(container);
    expect(() => list.updateItems(makeItems(200))).not.toThrow();
  });

  it('scrollToIndex(0) sets scrollTop=0', () => {
    const container = document.createElement('div');
    const list = createVirtualList({
      items:           makeItems(100),
      itemHeight:      40,
      containerHeight: 400,
      renderItem,
    });
    list.mount(container);
    expect(() => list.scrollToIndex(0)).not.toThrow();
    // scrollTop should be 0 * 40 = 0
    const scrollEl = container.firstChild as HTMLElement;
    expect(scrollEl.scrollTop).toBe(0);
  });

  it('destroy() removes container', () => {
    const container = document.createElement('div');
    const list = createVirtualList({
      items:           makeItems(100),
      itemHeight:      40,
      containerHeight: 400,
      renderItem,
    });
    list.mount(container);
    expect(container.firstChild).toBeTruthy();
    list.destroy();
    expect(container.firstChild).toBeNull();
  });

  it('overscan default is 3', () => {
    // When overscan is not specified, the visible range includes extra rows
    const itemHeight      = 40;
    const containerHeight = 200; // 5 visible rows
    const defaultOverscan = 3;
    const list = createVirtualList({
      items:           makeItems(100),
      itemHeight,
      containerHeight,
      renderItem,
      // overscan NOT set — defaults to 3
    });
    list.mount(document.createElement('div'));
    const range = list.visibleRange();
    // At scrollTop=0: start=max(0, 0-3)=0, end=ceil(200/40)+3=8
    const expectedEnd = Math.min(
      99,
      Math.ceil(containerHeight / itemHeight) + defaultOverscan,
    );
    expect(range.end).toBe(expectedEnd);
  });
});
