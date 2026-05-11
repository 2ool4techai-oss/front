import { signal } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface VirtualListOptions<T> {
  items:           T[];
  itemHeight:      number;
  containerHeight: number;
  renderItem:      (item: T, index: number) => HTMLElement;
  overscan?:       number;
  onScroll?:       (scrollTop: number) => void;
}

export interface VirtualListHandle<T> {
  mount(container: HTMLElement): void;
  updateItems(items: T[]): void;
  scrollToIndex(index: number): void;
  destroy(): void;
  readonly visibleRange: Signal<{ start: number; end: number }>;
}

// ── createVirtualList ──────────────────────────────────────────────────

export function createVirtualList<T>(
  opts: VirtualListOptions<T>,
): VirtualListHandle<T> {
  const overscan     = opts.overscan ?? 3;
  let items          = opts.items;
  let scrollEl:  HTMLElement | null = null;
  let innerEl:   HTMLElement | null = null;
  let outerEl:   HTMLElement | null = null;

  // Map from absolute index to rendered DOM element
  const rendered = new Map<number, HTMLElement>();

  const visibleRange = signal<{ start: number; end: number }>({
    start: 0,
    end:   Math.min(
      Math.ceil(opts.containerHeight / opts.itemHeight) + overscan,
      Math.max(opts.items.length - 1, 0),
    ),
  });

  function calcRange(scrollTop: number): { start: number; end: number } {
    const startIdx = Math.max(
      0,
      Math.floor(scrollTop / opts.itemHeight) - overscan,
    );
    const endIdx = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + opts.containerHeight) / opts.itemHeight) + overscan,
    );
    return { start: startIdx, end: endIdx };
  }

  function renderVisible(range: { start: number; end: number }): void {
    if (!innerEl) return;

    // Remove items outside range
    for (const [idx, el] of rendered) {
      if (idx < range.start || idx > range.end) {
        el.remove();
        rendered.delete(idx);
      }
    }

    // Add items inside range
    for (let i = range.start; i <= range.end; i++) {
      if (!rendered.has(i)) {
        const item = items[i];
        if (item === undefined) continue;
        const el = opts.renderItem(item, i);
        el.style.position = 'absolute';
        el.style.top      = `${i * opts.itemHeight}px`;
        el.style.left     = '0';
        el.style.right    = '0';
        el.style.height   = `${opts.itemHeight}px`;
        innerEl.appendChild(el);
        rendered.set(i, el);
      }
    }
  }

  function handleScroll(): void {
    if (!scrollEl) return;
    const scrollTop = scrollEl.scrollTop;
    const range     = calcRange(scrollTop);
    visibleRange.set(range);
    renderVisible(range);
    opts.onScroll?.(scrollTop);
  }

  function mount(container: HTMLElement): void {
    // Outer scroll container
    outerEl = document.createElement('div');
    outerEl.style.position   = 'relative';
    outerEl.style.overflow   = 'auto';
    outerEl.style.height     = `${opts.containerHeight}px`;
    scrollEl = outerEl;

    // Inner spacer that creates full scroll height
    innerEl = document.createElement('div');
    innerEl.style.position = 'relative';
    innerEl.style.height   = `${items.length * opts.itemHeight}px`;

    outerEl.appendChild(innerEl);
    container.appendChild(outerEl);

    outerEl.addEventListener('scroll', handleScroll, { passive: true });

    // Initial render
    const range = calcRange(0);
    visibleRange.set(range);
    renderVisible(range);
  }

  function updateItems(newItems: T[]): void {
    items = newItems;
    if (innerEl) {
      innerEl.style.height = `${items.length * opts.itemHeight}px`;
    }
    // Clear and re-render
    rendered.clear();
    if (innerEl) innerEl.innerHTML = '';
    const scrollTop = scrollEl?.scrollTop ?? 0;
    const range     = calcRange(scrollTop);
    visibleRange.set(range);
    renderVisible(range);
  }

  function scrollToIndex(index: number): void {
    if (!scrollEl) return;
    scrollEl.scrollTop = index * opts.itemHeight;
  }

  function destroy(): void {
    if (scrollEl) {
      scrollEl.removeEventListener('scroll', handleScroll);
    }
    if (outerEl?.parentElement) {
      outerEl.parentElement.removeChild(outerEl);
    }
    rendered.clear();
    scrollEl = null;
    innerEl  = null;
    outerEl  = null;
  }

  return { mount, updateItems, scrollToIndex, destroy, visibleRange };
}
