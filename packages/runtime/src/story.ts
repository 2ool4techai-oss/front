import type { Signal } from './types.js';

// ── Types ─────────────────────────────────────────────────────────────

export type StoryVariant<TProps> = TProps & {
  _name?: string;
  _description?: string;
};

export interface StoryDefinition<TProps extends Record<string, unknown>> {
  name:        string;
  component:   (props: TProps, container: HTMLElement) => HTMLElement | void;
  variants:    Record<string, StoryVariant<TProps>>;
  description?: string;
}

export interface StoryHandle {
  readonly name:    string;
  readonly stories: readonly StoryDefinition<Record<string, unknown>>[];
  /** Re-render a specific variant */
  render(storyName: string, variantName: string, container: HTMLElement): void;
  /** Get all registered story names */
  list(): string[];
}

// Global registry
const _stories = new Map<string, StoryDefinition<Record<string, unknown>>>();

/**
 * Register a component with named variants for the playground.
 *
 * @example
 * story(Button, {
 *   'Primary CTA': { label: 'Buy Now', variant: 'primary' },
 *   'Danger':      { label: 'Delete',  variant: 'danger'  },
 * });
 */
export function story<TProps extends Record<string, unknown>>(
  component:   (props: TProps, container: HTMLElement) => HTMLElement | void,
  variants:    Record<string, StoryVariant<TProps>>,
  opts?:       { name?: string; description?: string },
): void {
  const name = opts?.name ?? component.name ?? `Component_${_stories.size}`;
  const entry: StoryDefinition<Record<string, unknown>> = {
    name,
    component: component as (props: Record<string, unknown>, container: HTMLElement) => HTMLElement | void,
    variants:  variants as Record<string, StoryVariant<Record<string, unknown>>>,
  };
  if (opts?.description !== undefined) {
    entry.description = opts.description;
  }
  _stories.set(name, entry);
}

/** Get all registered stories */
export function getStories(): ReadonlyMap<string, StoryDefinition<Record<string, unknown>>> {
  return _stories;
}

/** Clear all registered stories (useful for testing) */
export function clearStories(): void {
  _stories.clear();
}
