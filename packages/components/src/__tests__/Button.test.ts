import { describe, it, expect, vi } from 'vitest';
import { signal } from '@drishti/runtime';
import { Button } from '../Button.js';

describe('Button', () => {
  it('renders with label', () => {
    const btn = Button({ label: 'Click me' });
    expect(btn.textContent).toContain('Click me');
  });

  it('applies primary variant by default', () => {
    const btn = Button({ label: 'Test' });
    expect(btn.className).toContain('primary');
  });

  it('applies variant class', () => {
    const btn = Button({ label: 'Test', variant: 'danger' });
    expect(btn.className).toContain('danger');
  });

  it('applies size class', () => {
    const btn = Button({ label: 'Test', size: 'lg' });
    expect(btn.className).toContain('lg');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const btn = Button({ label: 'Test', onClick });
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled signal is true', () => {
    const disabled = signal(false);
    const btn = Button({ label: 'Test', disabled }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    disabled.set(true);
    expect(btn.disabled).toBe(true);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    const btn = Button({ label: 'Test', onClick, disabled: signal(true) }) as HTMLButtonElement;
    btn.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('reactive label updates textContent', () => {
    const label = signal('Before');
    const btn = Button({ label });
    expect(btn.textContent).toContain('Before');
    label.set('After');
    expect(btn.textContent).toContain('After');
  });

  it('shows loading indicator when loading signal is true', () => {
    const loading = signal(false);
    const btn = Button({ label: 'Submit', loading });
    loading.set(true);
    // Should have a spinner/loading indicator
    expect(btn.querySelector('.dr-btn-spinner') || btn.getAttribute('aria-busy')).toBeTruthy();
  });
});
