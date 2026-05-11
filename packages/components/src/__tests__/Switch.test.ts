import { describe, it, expect, vi } from 'vitest';
import { createSwitch } from '../Switch.js';

describe('createSwitch', () => {
  it('createSwitch mounts to container', () => {
    const container = document.createElement('div');
    const sw = createSwitch();
    sw.mount(container);
    expect(container.querySelector('.dr-switch')).toBeTruthy();
  });

  it('checked signal starts from opts.checked', () => {
    const sw = createSwitch({ checked: true });
    expect(sw.checked()).toBe(true);

    const sw2 = createSwitch({ checked: false });
    expect(sw2.checked()).toBe(false);
  });

  it('toggle() flips checked', () => {
    const sw = createSwitch({ checked: false });
    sw.toggle();
    expect(sw.checked()).toBe(true);
    sw.toggle();
    expect(sw.checked()).toBe(false);
  });

  it('mount + space key toggles', () => {
    const container = document.createElement('div');
    const sw = createSwitch({ checked: false });
    sw.mount(container);
    expect(sw.checked()).toBe(false);

    const track = container.querySelector('.dr-switch__track') as HTMLElement;
    expect(track).toBeTruthy();

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    track.dispatchEvent(event);

    expect(sw.checked()).toBe(true);
  });

  it('onChange called on toggle', () => {
    const onChange = vi.fn();
    const sw = createSwitch({ onChange });
    sw.toggle();
    expect(onChange).toHaveBeenCalledWith(true);
    sw.toggle();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('destroy() removes element', () => {
    const container = document.createElement('div');
    const sw = createSwitch();
    sw.mount(container);
    expect(container.querySelector('.dr-switch')).toBeTruthy();
    sw.destroy();
    expect(container.querySelector('.dr-switch')).toBeNull();
  });
});
