import { _setSSRMode } from './signal.js';

export interface IslandOptions {
  /** Unique name for this island — used as the data-island attribute value */
  name: string;
  /** Loading strategy: eager (immediate), visible (IntersectionObserver), idle (requestIdleCallback), interaction (first click/focus) */
  loading?: 'eager' | 'visible' | 'idle' | 'interaction';
  /** If true, render static HTML placeholder on server with no JS */
  staticFallback?: boolean;
}

export interface IslandDefinition<TProps extends Record<string, unknown>> {
  name:     string;
  options:  IslandOptions;
  factory:  (props: TProps, container: HTMLElement) => HTMLElement | void;
}

export interface IslandManifest {
  [name: string]: IslandDefinition<Record<string, unknown>>;
}

// Global island registry
const _registry = new Map<string, IslandDefinition<Record<string, unknown>>>();

/**
 * Define an interactive island component.
 * On the server: renders static HTML with data-island + data-island-props attributes.
 * On the client: deferred hydration based on loading strategy.
 */
export function defineIsland<TProps extends Record<string, unknown>>(
  opts: IslandOptions,
  factory: (props: TProps, container: HTMLElement) => HTMLElement | void
): (props: TProps) => HTMLElement {
  const def: IslandDefinition<TProps> = { name: opts.name, options: opts, factory };
  _registry.set(opts.name, def as IslandDefinition<Record<string, unknown>>);

  return (props: TProps): HTMLElement => {
    const container = document.createElement('div');
    container.dataset['island'] = opts.name;
    container.dataset['islandProps'] = JSON.stringify(props);
    container.dataset['islandLoading'] = opts.loading ?? 'eager';

    // In SSR mode, optionally render static fallback synchronously
    if (opts.staticFallback) {
      try {
        _setSSRMode(true);
        const result = factory(props, container);
        if (result instanceof HTMLElement) container.appendChild(result);
      } finally {
        _setSSRMode(false);
      }
    }
    return container;
  };
}

/**
 * Client-side: scan DOM for [data-island] elements and hydrate them.
 * Call this once in your client entry point.
 */
export function hydrateIslands(root: HTMLElement = document.body): void {
  const islands = root.querySelectorAll<HTMLElement>('[data-island]');
  for (const el of islands) {
    const name    = el.dataset['island']!;
    const props   = JSON.parse(el.dataset['islandProps'] ?? '{}') as Record<string, unknown>;
    const loading = (el.dataset['islandLoading'] ?? 'eager') as IslandOptions['loading'];
    const def     = _registry.get(name);
    if (!def) continue;

    const hydrate = () => {
      el.innerHTML = '';
      const result = def.factory(props, el);
      if (result instanceof HTMLElement) el.appendChild(result);
    };

    if (loading === 'eager') {
      hydrate();
    } else if (loading === 'visible') {
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) { io.disconnect(); hydrate(); }
          }
        }, { rootMargin: '200px' });
        io.observe(el);
      } else {
        hydrate(); // fallback
      }
    } else if (loading === 'idle') {
      if ('requestIdleCallback' in window) {
        (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(hydrate);
      } else {
        setTimeout(hydrate, 1);
      }
    } else if (loading === 'interaction') {
      const once = () => { el.removeEventListener('click', once); el.removeEventListener('focus', once, true); hydrate(); };
      el.addEventListener('click', once);
      el.addEventListener('focus', once, true);
    }
  }
}

/** Get all registered island names */
export function getIslandRegistry(): ReadonlyMap<string, IslandDefinition<Record<string, unknown>>> {
  return _registry;
}

/** Generate a minimal JS bootstrap snippet that only imports islands used in the page */
export function generateIslandBootstrap(usedIslands: string[]): string {
  const lines = [
    `import { hydrateIslands } from '@drishti/runtime';`,
    ...usedIslands.map(name => `import './${name}.island.js';`),
    `hydrateIslands();`,
  ];
  return lines.join('\n');
}
