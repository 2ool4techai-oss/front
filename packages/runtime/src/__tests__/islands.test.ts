import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  defineIsland,
  hydrateIslands,
  getIslandRegistry,
  generateIslandBootstrap,
} from '../islands.js';

// Clear the registry between tests by re-importing is not feasible;
// we rely on island names being unique per test to avoid cross-test pollution.

describe('defineIsland', () => {
  it('registers and returns a factory', () => {
    defineIsland({ name: 'test-register' }, (_props, _container) => {});
    expect(getIslandRegistry().has('test-register')).toBe(true);
  });

  it('factory creates element with data-island attribute', () => {
    const render = defineIsland<{ count: number }>({ name: 'test-attr' }, () => {});
    const el = render({ count: 1 });
    expect(el.dataset['island']).toBe('test-attr');
  });

  it('factory serializes props to data-island-props', () => {
    const render = defineIsland<{ value: string; num: number }>({ name: 'test-props' }, () => {});
    const props = { value: 'hello', num: 42 };
    const el = render(props);
    expect(JSON.parse(el.dataset['islandProps'] ?? '{}')).toEqual(props);
  });

  it('loading strategy is written to data-island-loading', () => {
    const renderEager = defineIsland<Record<string, unknown>>({ name: 'test-loading-eager', loading: 'eager' }, () => {});
    const renderVisible = defineIsland<Record<string, unknown>>({ name: 'test-loading-visible', loading: 'visible' }, () => {});
    const renderIdle = defineIsland<Record<string, unknown>>({ name: 'test-loading-idle', loading: 'idle' }, () => {});
    const renderInteraction = defineIsland<Record<string, unknown>>({ name: 'test-loading-interaction', loading: 'interaction' }, () => {});

    expect(renderEager({}).dataset['islandLoading']).toBe('eager');
    expect(renderVisible({}).dataset['islandLoading']).toBe('visible');
    expect(renderIdle({}).dataset['islandLoading']).toBe('idle');
    expect(renderInteraction({}).dataset['islandLoading']).toBe('interaction');
  });

  it('defaults loading to eager when not specified', () => {
    const render = defineIsland<Record<string, unknown>>({ name: 'test-default-loading' }, () => {});
    expect(render({}).dataset['islandLoading']).toBe('eager');
  });
});

describe('hydrateIslands', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('with eager loading calls factory immediately', () => {
    const factory = vi.fn((_props: Record<string, unknown>, _container: HTMLElement) => {});
    defineIsland<Record<string, unknown>>({ name: 'hydrate-eager', loading: 'eager' }, factory);

    const container = document.createElement('div');
    container.dataset['island'] = 'hydrate-eager';
    container.dataset['islandProps'] = JSON.stringify({ x: 1 });
    container.dataset['islandLoading'] = 'eager';
    document.body.appendChild(container);

    hydrateIslands(document.body);
    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith({ x: 1 }, container);
  });

  it('with visible loading uses IntersectionObserver', () => {
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();
    let capturedCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;

    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
        capturedCallback = cb;
      }
      observe = observeSpy;
      disconnect = disconnectSpy;
    });

    const factory = vi.fn((_props: Record<string, unknown>, _container: HTMLElement) => {});
    defineIsland<Record<string, unknown>>({ name: 'hydrate-visible', loading: 'visible' }, factory);

    const container = document.createElement('div');
    container.dataset['island'] = 'hydrate-visible';
    container.dataset['islandProps'] = JSON.stringify({});
    container.dataset['islandLoading'] = 'visible';
    document.body.appendChild(container);

    hydrateIslands(document.body);
    expect(observeSpy).toHaveBeenCalledWith(container);
    expect(factory).not.toHaveBeenCalled();

    // Simulate intersection
    capturedCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(factory).toHaveBeenCalledOnce();
    expect(disconnectSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('with idle loading uses requestIdleCallback', () => {
    let capturedCb: (() => void) | null = null;
    const ricSpy = vi.fn((cb: () => void) => { capturedCb = cb; });
    vi.stubGlobal('requestIdleCallback', ricSpy);

    const factory = vi.fn((_props: Record<string, unknown>, _container: HTMLElement) => {});
    defineIsland<Record<string, unknown>>({ name: 'hydrate-idle', loading: 'idle' }, factory);

    const container = document.createElement('div');
    container.dataset['island'] = 'hydrate-idle';
    container.dataset['islandProps'] = JSON.stringify({});
    container.dataset['islandLoading'] = 'idle';
    document.body.appendChild(container);

    hydrateIslands(document.body);
    expect(ricSpy).toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();

    capturedCb!();
    expect(factory).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('with interaction loading hydrates on click', () => {
    const factory = vi.fn((_props: Record<string, unknown>, _container: HTMLElement) => {});
    defineIsland<Record<string, unknown>>({ name: 'hydrate-interaction', loading: 'interaction' }, factory);

    const container = document.createElement('div');
    container.dataset['island'] = 'hydrate-interaction';
    container.dataset['islandProps'] = JSON.stringify({ label: 'btn' });
    container.dataset['islandLoading'] = 'interaction';
    document.body.appendChild(container);

    hydrateIslands(document.body);
    expect(factory).not.toHaveBeenCalled();

    container.click();
    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith({ label: 'btn' }, container);
  });

  it('skips unknown island names gracefully', () => {
    const container = document.createElement('div');
    container.dataset['island'] = 'unknown-island-xyz';
    container.dataset['islandProps'] = '{}';
    container.dataset['islandLoading'] = 'eager';
    document.body.appendChild(container);

    // Should not throw
    expect(() => hydrateIslands(document.body)).not.toThrow();
  });
});

describe('getIslandRegistry', () => {
  it('returns registered islands', () => {
    defineIsland<Record<string, unknown>>({ name: 'registry-test-a' }, () => {});
    defineIsland<Record<string, unknown>>({ name: 'registry-test-b' }, () => {});
    const registry = getIslandRegistry();
    expect(registry.has('registry-test-a')).toBe(true);
    expect(registry.has('registry-test-b')).toBe(true);
  });

  it('returns a readonly map', () => {
    const registry = getIslandRegistry();
    expect(registry).toBeInstanceOf(Map);
  });
});

describe('generateIslandBootstrap', () => {
  it('produces correct import lines', () => {
    const result = generateIslandBootstrap(['counter', 'search']);
    expect(result).toContain(`import { hydrateIslands } from '@nexoraaidrishti/runtime';`);
    expect(result).toContain(`import './counter.island.js';`);
    expect(result).toContain(`import './search.island.js';`);
    expect(result).toContain(`hydrateIslands();`);
  });

  it('handles empty island list', () => {
    const result = generateIslandBootstrap([]);
    expect(result).toContain(`import { hydrateIslands } from '@nexoraaidrishti/runtime';`);
    expect(result).toContain(`hydrateIslands();`);
    expect(result).not.toContain('.island.js');
  });
});
