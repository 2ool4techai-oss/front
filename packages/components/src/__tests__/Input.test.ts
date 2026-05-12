import { describe, it, expect, vi } from 'vitest';
import { signal } from '@nexoraaidrishti/runtime';
import { Input } from '../Input.js';

describe('Input', () => {
  const getInput = (el: HTMLElement): HTMLInputElement =>
    el.querySelector('input') as HTMLInputElement;

  it('renders an input element', () => {
    const el = Input({ placeholder: 'Enter value' });
    expect(getInput(el)).toBeTruthy();
  });

  it('sets placeholder', () => {
    const el = Input({ placeholder: 'Search…' });
    expect(getInput(el).placeholder).toBe('Search…');
  });

  it('updates signal value on input event', () => {
    const value = signal('');
    const el = Input({ value });
    const input = getInput(el);
    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(value()).toBe('hello');
  });

  it('reflects signal value in input', () => {
    const value = signal('initial');
    const el = Input({ value });
    expect(getInput(el).value).toBe('initial');
    value.set('updated');
    expect(getInput(el).value).toBe('updated');
  });

  it('shows validation error', () => {
    const el = Input({
      validate: (v) => v.length < 3 ? 'Too short' : null,
    });
    const input = getInput(el);
    input.dispatchEvent(new Event('blur'));
    const errorEl = el.querySelector('.dr-input-error');
    expect(errorEl?.textContent).toBe('Too short');
  });

  it('clears error when value is valid', () => {
    const el = Input({
      validate: (v) => v.length < 3 ? 'Too short' : null,
    });
    const input = getInput(el);
    input.dispatchEvent(new Event('blur'));
    input.value = 'valid value';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    const errorEl = el.querySelector('.dr-input-error');
    expect(errorEl?.textContent).toBe('');
  });

  it('is disabled when disabled signal is true', () => {
    const disabled = signal(true);
    const el = Input({ disabled });
    expect(getInput(el).disabled).toBe(true);
  });

  it('renders label when provided', () => {
    const el = Input({ label: 'Full Name' });
    expect(el.textContent).toContain('Full Name');
  });
});
