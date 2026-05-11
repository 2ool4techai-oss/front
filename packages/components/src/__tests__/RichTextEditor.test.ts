import { describe, it, expect, vi } from 'vitest';
import { createRTE } from '../RichTextEditor.js';

describe('createRTE', () => {
  it('mount() does not throw', () => {
    const container = document.createElement('div');
    const rte = createRTE();
    expect(() => rte.mount(container)).not.toThrow();
  });

  it('value starts with initialValue', () => {
    const rte = createRTE({ initialValue: '<p>Hello</p>' });
    expect(rte.value()).toBe('<p>Hello</p>');
  });

  it('setValue() updates innerHTML and signal', () => {
    const container = document.createElement('div');
    const rte = createRTE();
    rte.mount(container);
    rte.setValue('<p>New content</p>');
    expect(rte.value()).toBe('<p>New content</p>');
    const editorEl = container.querySelector('.dr-rte__content') as HTMLElement;
    expect(editorEl.innerHTML).toBe('<p>New content</p>');
  });

  it('getValue() returns current content', () => {
    const container = document.createElement('div');
    const rte = createRTE({ initialValue: '<b>test</b>' });
    rte.mount(container);
    expect(rte.getValue()).toBe('<b>test</b>');
  });

  it('focus and blur do not throw', () => {
    const container = document.createElement('div');
    const rte = createRTE();
    rte.mount(container);
    expect(() => rte.focus()).not.toThrow();
    expect(() => rte.blur()).not.toThrow();
  });

  it('destroy() removes element', () => {
    const container = document.createElement('div');
    const rte = createRTE();
    rte.mount(container);
    expect(container.querySelector('.dr-rte')).toBeTruthy();
    rte.destroy();
    expect(container.querySelector('.dr-rte')).toBeNull();
  });

  it('onChange called on input event', () => {
    const container = document.createElement('div');
    const onChange = vi.fn();
    const rte = createRTE({ onChange });
    rte.mount(container);
    const editorEl = container.querySelector('.dr-rte__content') as HTMLElement;
    editorEl.innerHTML = '<p>typed</p>';
    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('<p>typed</p>');
  });
});
