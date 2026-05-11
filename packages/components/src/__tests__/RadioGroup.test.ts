import { describe, it, expect, vi } from 'vitest';
import { createRadioGroup } from '../RadioGroup.js';

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C', disabled: true },
];

describe('createRadioGroup', () => {
  it('mounts to container', () => {
    const container = document.createElement('div');
    const rg = createRadioGroup({ options: OPTIONS });
    rg.mount(container);
    expect(container.querySelector('.dr-radiogroup')).toBeTruthy();
  });

  it('value signal from opts.value', () => {
    const rg = createRadioGroup({ options: OPTIONS, value: 'b' });
    expect(rg.value()).toBe('b');

    const rg2 = createRadioGroup({ options: OPTIONS });
    expect(rg2.value()).toBe('');
  });

  it('setValue() updates signal', () => {
    const rg = createRadioGroup({ options: OPTIONS });
    rg.setValue('a');
    expect(rg.value()).toBe('a');
    rg.setValue('b');
    expect(rg.value()).toBe('b');
  });

  it('DOM contains radio inputs', () => {
    const container = document.createElement('div');
    const rg = createRadioGroup({ options: OPTIONS });
    rg.mount(container);
    const inputs = container.querySelectorAll('input[type="radio"]');
    expect(inputs.length).toBe(OPTIONS.length);
  });

  it('onChange called on setValue', () => {
    const onChange = vi.fn();
    const rg = createRadioGroup({ options: OPTIONS, onChange });
    rg.setValue('a');
    expect(onChange).toHaveBeenCalledWith('a');
    rg.setValue('b');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('disabled option has disabled attribute', () => {
    const container = document.createElement('div');
    const rg = createRadioGroup({ options: OPTIONS });
    rg.mount(container);
    const inputs = container.querySelectorAll('input[type="radio"]');
    const disabledInput = Array.from(inputs).find(
      (i) => (i as HTMLInputElement).value === 'c',
    ) as HTMLInputElement | undefined;
    expect(disabledInput?.disabled).toBe(true);
  });

  it('destroy() removes element', () => {
    const container = document.createElement('div');
    const rg = createRadioGroup({ options: OPTIONS });
    rg.mount(container);
    expect(container.querySelector('.dr-radiogroup')).toBeTruthy();
    rg.destroy();
    expect(container.querySelector('.dr-radiogroup')).toBeNull();
  });
});
