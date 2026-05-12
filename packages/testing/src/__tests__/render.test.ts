import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@nexoraaidrishti/runtime';
import { render, fireEvent, waitFor, waitForSignal } from '../render.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('render()', () => {
  it('mounts element to body', () => {
    const div = document.createElement('div');
    div.textContent = 'hello';
    render(div);
    expect(document.body.contains(div)).toBe(true);
  });

  it('render with factory function works', () => {
    const result = render(() => {
      const el = document.createElement('span');
      el.textContent = 'factory';
      return el;
    });
    expect(result.container.textContent).toContain('factory');
  });

  it('getBy returns element', () => {
    const { getBy } = render(() => {
      const el = document.createElement('div');
      el.innerHTML = '<button class="my-btn">OK</button>';
      return el;
    });
    const btn = getBy('.my-btn');
    expect(btn.tagName.toLowerCase()).toBe('button');
  });

  it('getBy throws when not found', () => {
    const { getBy } = render(() => document.createElement('div'));
    expect(() => getBy('.nonexistent')).toThrow();
  });

  it('queryBy returns null when not found', () => {
    const { queryBy } = render(() => document.createElement('div'));
    expect(queryBy('.nonexistent')).toBeNull();
  });

  it('getByText finds element by text content', () => {
    const { getByText } = render(() => {
      const el = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = 'Hello World';
      el.appendChild(p);
      return el;
    });
    const p = getByText('Hello World');
    expect(p.tagName.toLowerCase()).toBe('p');
  });

  it('getByRole finds by role attribute', () => {
    const { getByRole } = render(() => {
      const el = document.createElement('div');
      el.innerHTML = '<div role="dialog">Content</div>';
      return el;
    });
    const dialog = getByRole('dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
  });

  it('getByRole with name option filters correctly', () => {
    const { getByRole } = render(() => {
      const el = document.createElement('div');
      el.innerHTML = `
        <button role="button" aria-label="Cancel">Cancel</button>
        <button role="button" aria-label="Submit form">Submit</button>
      `;
      return el;
    });
    const btn = getByRole('button', { name: 'Submit' });
    expect(btn.getAttribute('aria-label')).toBe('Submit form');
  });

  it('fireEvent.click dispatches click event', () => {
    const onClick = vi.fn();
    const { getBy } = render(() => {
      const el = document.createElement('div');
      const btn = document.createElement('button');
      btn.className = 'clk-btn';
      btn.addEventListener('click', onClick);
      el.appendChild(btn);
      return el;
    });
    fireEvent.click(getBy('.clk-btn'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fireEvent.input sets value and fires event', () => {
    const onInput = vi.fn();
    const { getBy } = render(() => {
      const el = document.createElement('div');
      const input = document.createElement('input');
      input.className = 'my-input';
      input.addEventListener('input', onInput);
      el.appendChild(input);
      return el;
    });
    const input = getBy('.my-input') as HTMLInputElement;
    fireEvent.input(input, 'hello');
    expect(input.value).toBe('hello');
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('type() fires events for each character', () => {
    const keydownEvents: string[] = [];
    const { getBy, type } = render(() => {
      const el = document.createElement('div');
      const input = document.createElement('input');
      input.className = 'type-input';
      input.addEventListener('keydown', (e) => keydownEvents.push((e as KeyboardEvent).key));
      el.appendChild(input);
      return el;
    });
    const input = getBy('.type-input');
    type(input, 'abc');
    expect(keydownEvents).toEqual(['a', 'b', 'c']);
    expect((input as HTMLInputElement).value).toBe('abc');
  });

  it('waitFor resolves when condition true', async () => {
    let ready = false;
    setTimeout(() => { ready = true; }, 50);
    await waitFor(() => ready, 500);
    expect(ready).toBe(true);
  });

  it('waitFor rejects after timeout', async () => {
    await expect(waitFor(() => false, 50)).rejects.toThrow();
  });

  it('waitForSignal resolves when signal matches', async () => {
    const sig = signal(0);
    setTimeout(() => sig.set(42), 50);
    await waitForSignal(sig, 42, 500);
    expect(sig()).toBe(42);
  });

  it('unmount() removes container from DOM', () => {
    const { container, unmount } = render(() => document.createElement('div'));
    expect(document.body.contains(container)).toBe(true);
    unmount();
    expect(document.body.contains(container)).toBe(false);
  });
});
