import { signal } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface InfiniteScrollOptions<T> {
  fetchMore:      () => Promise<T[]>;
  renderItem:     (item: T, index: number) => HTMLElement;
  initialItems?:  T[];
  threshold?:     number;      // px from bottom to trigger fetch, default 200
  pageSize?:      number;      // expected items per page (for end detection), default 20
  loadingEl?:     HTMLElement; // custom loading indicator
  endEl?:         HTMLElement; // shown when no more items
  onError?:       (err: unknown) => void;
}

export interface InfiniteScrollHandle<T> {
  readonly items:   Signal<T[]>;
  readonly loading: Signal<boolean>;
  readonly hasMore: Signal<boolean>;
  readonly error:   Signal<unknown>;
  reset():          void;
  prepend(items: T[]): void;
  destroy():        void;
  mount(container: HTMLElement): void;
}

// ── CSS injection ──────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById('dr-infinite-scroll-styles')) return;
  const style = document.createElement('style');
  style.id = 'dr-infinite-scroll-styles';
  style.textContent = `
    .dr-infinite-scroll {
      overflow-y: auto;
      position: relative;
    }
    .dr-infinite-scroll__list {
      display: flex;
      flex-direction: column;
    }
    .dr-infinite-scroll__loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      color: var(--dr-color-text-muted, #64748b);
      font-size: 14px;
    }
    .dr-infinite-scroll__end {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      color: var(--dr-color-text-muted, #64748b);
      font-size: 14px;
    }
    .dr-infinite-scroll__sentinel {
      height: 1px;
      width: 100%;
    }
  `;
  document.head.appendChild(style);
}

// ── createInfiniteScroll ───────────────────────────────────────────────

export function createInfiniteScroll<T>(opts: InfiniteScrollOptions<T>): InfiniteScrollHandle<T> {
  const pageSize  = opts.pageSize  ?? 20;

  const items   = signal<T[]>(opts.initialItems ? [...opts.initialItems] : []);
  const loading = signal<boolean>(false);
  const hasMore = signal<boolean>(true);
  const error   = signal<unknown>(undefined);

  let containerEl: HTMLElement | null = null;
  let listEl:      HTMLElement | null = null;
  let sentinelEl:  HTMLElement | null = null;
  let loadingEl:   HTMLElement | null = null;
  let endEl:       HTMLElement | null = null;
  let observer:    IntersectionObserver | null = null;

  function createDefaultLoadingEl(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dr-infinite-scroll__loading';
    el.textContent = 'Loading...';
    return el;
  }

  function createDefaultEndEl(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dr-infinite-scroll__end';
    el.textContent = 'No more items';
    return el;
  }

  function renderItems(newItems: T[], startIndex: number): void {
    if (!listEl) return;
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item === undefined) continue;
      const el = opts.renderItem(item, startIndex + i);
      listEl.appendChild(el);
    }
  }

  async function doFetch(): Promise<void> {
    if (loading()) return;
    if (!hasMore()) return;

    loading.set(true);
    if (loadingEl && containerEl) {
      containerEl.appendChild(loadingEl);
    }

    try {
      const newItems = await opts.fetchMore();
      const currentItems = items();
      const startIndex = currentItems.length;
      items.set([...currentItems, ...newItems]);
      renderItems(newItems, startIndex);

      if (newItems.length < pageSize) {
        hasMore.set(false);
        if (observer && sentinelEl) {
          observer.unobserve(sentinelEl);
          observer.disconnect();
          observer = null;
        }
        if (endEl && containerEl) {
          containerEl.appendChild(endEl);
        }
      }
    } catch (err) {
      error.set(err);
      if (opts.onError !== undefined) opts.onError(err);
    } finally {
      loading.set(false);
      if (loadingEl?.parentElement) {
        loadingEl.parentElement.removeChild(loadingEl);
      }
    }
  }

  function setupObserver(): void {
    if (!sentinelEl) return;
    if (typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined && entry.isIntersecting) {
        void doFetch();
      }
    });
    observer.observe(sentinelEl);
  }

  function mount(container: HTMLElement): void {
    injectStyles();

    containerEl = document.createElement('div');
    containerEl.className = 'dr-infinite-scroll';

    listEl = document.createElement('div');
    listEl.className = 'dr-infinite-scroll__list';
    containerEl.appendChild(listEl);

    // Render initial items
    const initialItems = items();
    renderItems(initialItems, 0);

    // Sentinel element
    sentinelEl = document.createElement('div');
    sentinelEl.className = 'dr-infinite-scroll__sentinel';
    containerEl.appendChild(sentinelEl);

    // Loading element
    loadingEl = opts.loadingEl ?? createDefaultLoadingEl();

    // End element
    endEl = opts.endEl ?? createDefaultEndEl();

    container.appendChild(containerEl);
    setupObserver();
  }

  function reset(): void {
    items.set([]);
    hasMore.set(true);
    error.set(undefined);

    if (listEl) {
      listEl.innerHTML = '';
    }
    if (endEl?.parentElement) {
      endEl.parentElement.removeChild(endEl);
    }

    // Reconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (sentinelEl) {
      setupObserver();
    }
  }

  function prepend(newItems: T[]): void {
    const currentItems = items();
    items.set([...newItems, ...currentItems]);

    if (listEl) {
      // Insert at top
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        if (item === undefined) continue;
        const el = opts.renderItem(item, i);
        fragment.appendChild(el);
      }
      listEl.insertBefore(fragment, listEl.firstChild);

      // Update indices of existing rendered items by re-rendering (simple approach)
    }
  }

  function destroy(): void {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (containerEl?.parentElement) {
      containerEl.parentElement.removeChild(containerEl);
    }
    containerEl = null;
    listEl      = null;
    sentinelEl  = null;
  }

  return { items, loading, hasMore, error, reset, prepend, destroy, mount };
}
