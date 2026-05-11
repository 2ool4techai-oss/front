import { describe, it, expect } from 'vitest';
import { createSlider } from '../Slider.js';

describe('createSlider', () => {
  it('mounts to container', () => {
    const container = document.createElement('div');
    const slider = createSlider();
    slider.mount(container);
    expect(container.querySelector('.dr-slider')).toBeTruthy();
  });

  it('value signal starts at min (or opts.value)', () => {
    const s1 = createSlider({ min: 10, max: 100 });
    expect(s1.value()).toBe(10);

    const s2 = createSlider({ min: 0, max: 100, value: 42 });
    expect(s2.value()).toBe(42);
  });

  it('setValue() updates signal', () => {
    const slider = createSlider({ min: 0, max: 100 });
    slider.setValue(50);
    expect(slider.value()).toBe(50);
  });

  it('setValue clamps to [min, max]', () => {
    const slider = createSlider({ min: 0, max: 100 });
    slider.setValue(-10);
    expect(slider.value()).toBe(0);
    slider.setValue(200);
    expect(slider.value()).toBe(100);
  });

  it('setValue snaps to step', () => {
    const slider = createSlider({ min: 0, max: 100, step: 10 });
    slider.setValue(23);
    expect(slider.value()).toBe(20);
    slider.setValue(27);
    expect(slider.value()).toBe(30);
  });

  it('range mode: valueB signal exists', () => {
    const slider = createSlider({ range: true, min: 0, max: 100, value: 20, valueB: 80 });
    expect(slider.valueB()).toBe(80);
  });

  it('destroy() removes element', () => {
    const container = document.createElement('div');
    const slider = createSlider();
    slider.mount(container);
    expect(container.querySelector('.dr-slider')).toBeTruthy();
    slider.destroy();
    expect(container.querySelector('.dr-slider')).toBeNull();
  });

  it('ARIA attributes present on thumb', () => {
    const container = document.createElement('div');
    const slider = createSlider({ min: 0, max: 100, value: 50, label: 'Volume' });
    slider.mount(container);
    const thumb = container.querySelector('.dr-slider-thumb');
    expect(thumb).toBeTruthy();
    expect(thumb?.getAttribute('role')).toBe('slider');
    expect(thumb?.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb?.getAttribute('aria-valuemax')).toBe('100');
    expect(thumb?.getAttribute('aria-valuenow')).toBe('50');
    expect(thumb?.getAttribute('aria-label')).toBe('Volume');
  });
});
