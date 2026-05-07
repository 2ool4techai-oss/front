import { describe, it, expect, beforeEach } from 'vitest';
import { story, getStories, clearStories } from '../story.js';

// Reset registry before each test to ensure isolation
beforeEach(() => {
  clearStories();
});

describe('story()', () => {
  it('registers a component with variants', () => {
    function Button(props: { label: string }, _container: HTMLElement) {
      const el = document.createElement('button');
      el.textContent = props.label;
      return el;
    }

    story(Button, {
      'Primary CTA': { label: 'Buy Now' },
      Danger:        { label: 'Delete' },
    });

    const stories = getStories();
    expect(stories.size).toBe(1);
    expect(stories.has('Button')).toBe(true);
  });

  it('getStories() returns all registered stories', () => {
    function Alpha(_props: Record<string, unknown>, _c: HTMLElement) {}
    function Beta(_props: Record<string, unknown>, _c: HTMLElement) {}

    story(Alpha, { default: {} });
    story(Beta,  { default: {} });

    const stories = getStories();
    expect(stories.size).toBe(2);
    expect(stories.has('Alpha')).toBe(true);
    expect(stories.has('Beta')).toBe(true);
  });

  it('uses component.name as default name', () => {
    function MyComponent(_props: { text: string }, _c: HTMLElement) {}

    story(MyComponent, { 'Default': { text: 'hello' } });

    const stories = getStories();
    expect(stories.has('MyComponent')).toBe(true);
  });

  it('opts.name overrides function name', () => {
    function ButtonComponent(_props: { label: string }, _c: HTMLElement) {}

    story(ButtonComponent, { Default: { label: 'Click me' } }, { name: 'CustomButton' });

    const stories = getStories();
    expect(stories.has('CustomButton')).toBe(true);
    expect(stories.has('ButtonComponent')).toBe(false);
  });

  it('clearStories() empties the registry', () => {
    function Foo(_props: Record<string, unknown>, _c: HTMLElement) {}
    story(Foo, { default: {} });
    expect(getStories().size).toBe(1);

    clearStories();
    expect(getStories().size).toBe(0);
  });

  it('multiple stories can be registered', () => {
    function Card(_props: { title: string }, _c: HTMLElement) {}
    function Modal(_props: { open: boolean }, _c: HTMLElement) {}
    function Badge(_props: { count: number }, _c: HTMLElement) {}

    story(Card,  { Default: { title: 'Hello' } });
    story(Modal, { Open: { open: true }, Closed: { open: false } });
    story(Badge, { Zero: { count: 0 }, Many: { count: 99 } });

    const stories = getStories();
    expect(stories.size).toBe(3);
    expect(stories.has('Card')).toBe(true);
    expect(stories.has('Modal')).toBe(true);
    expect(stories.has('Badge')).toBe(true);
  });

  it('variants are stored with their props', () => {
    function Chip(_props: { label: string; color: string }, _c: HTMLElement) {}

    story(Chip, {
      Red:   { label: 'Error',   color: 'red'   },
      Green: { label: 'Success', color: 'green' },
    });

    const stories = getStories();
    const chipStory = stories.get('Chip');
    expect(chipStory).toBeDefined();
    expect(chipStory!.variants['Red']).toMatchObject({ label: 'Error', color: 'red' });
    expect(chipStory!.variants['Green']).toMatchObject({ label: 'Success', color: 'green' });
  });

  it('description is stored when provided', () => {
    function Widget(_props: Record<string, unknown>, _c: HTMLElement) {}

    story(Widget, { Default: {} }, { description: 'A reusable widget' });

    const stories = getStories();
    const def = stories.get('Widget');
    expect(def?.description).toBe('A reusable widget');
  });

  it('getStories() returns a read-only map', () => {
    const stories = getStories();
    expect(stories).toBeInstanceOf(Map);
    // Should be readonly — direct cast check
    expect(typeof (stories as Map<string, unknown>).set).toBe('function'); // underlying Map has set
    // But the type signature is ReadonlyMap — this is a type-level guarantee, runtime is Map
  });
});
