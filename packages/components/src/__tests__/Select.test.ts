import { describe, it, expect } from 'vitest';
import { createSelect } from '../Select.js';

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C', disabled: true },
];

describe('createSelect', () => {
  it('createSelect mounts to container', () => {
    const container = document.createElement('div');
    const select = createSelect({ options: OPTIONS });
    select.mount(container);
    expect(container.querySelector('.dr-select')).toBeTruthy();
  });

  it('value signal initialized from opts.value', () => {
    const select = createSelect({ options: OPTIONS, value: 'b' });
    expect(select.value()).toBe('b');
  });

  it('open() shows dropdown', () => {
    const container = document.createElement('div');
    const select = createSelect({ options: OPTIONS });
    select.mount(container);
    select.open();
    const dropdown = container.querySelector('.dr-select__dropdown');
    expect(dropdown?.classList.contains('dr-select__dropdown--open')).toBe(true);
  });

  it('close() hides dropdown', () => {
    const container = document.createElement('div');
    const select = createSelect({ options: OPTIONS });
    select.mount(container);
    select.open();
    select.close();
    const dropdown = container.querySelector('.dr-select__dropdown');
    expect(dropdown?.classList.contains('dr-select__dropdown--open')).toBe(false);
  });

  it('reset() clears value', () => {
    const select = createSelect({ options: OPTIONS, value: 'a' });
    select.reset();
    expect(select.value()).toBe('');
  });

  it('destroy() removes from DOM', () => {
    const container = document.createElement('div');
    const select = createSelect({ options: OPTIONS });
    select.mount(container);
    expect(container.querySelector('.dr-select')).toBeTruthy();
    select.destroy();
    expect(container.querySelector('.dr-select')).toBeNull();
  });
});
