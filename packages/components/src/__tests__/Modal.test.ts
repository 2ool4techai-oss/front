import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createModal, confirm, alert } from '../Modal.js';

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('Modal', () => {
  it('createModal returns handle with open/close', () => {
    const modal = createModal({ content: 'Hello' });
    expect(typeof modal.open).toBe('function');
    expect(typeof modal.close).toBe('function');
    expect(typeof modal.destroy).toBe('function');
  });

  it('open() makes modal visible', () => {
    const modal = createModal({ content: 'Visible' });
    modal.open();
    const backdrop = document.body.querySelector('.dr-modal-backdrop');
    expect(backdrop).toBeTruthy();
    modal.destroy();
  });

  it('close() hides modal', () => {
    vi.useFakeTimers();
    const modal = createModal({ content: 'Closeable' });
    modal.open();
    expect(document.body.querySelector('.dr-modal-backdrop')).toBeTruthy();
    modal.close();
    // Advance past the animation fallback timeout
    vi.advanceTimersByTime(400);
    expect(document.body.querySelector('.dr-modal-backdrop')).toBeFalsy();
    vi.useRealTimers();
  });

  it('isOpen signal reflects state', () => {
    const modal = createModal({ content: 'Signal test' });
    expect(modal.isOpen()).toBe(false);
    modal.open();
    expect(modal.isOpen()).toBe(true);
    modal.destroy();
  });

  it('closable=false hides X button', () => {
    const modal = createModal({ content: 'No close', title: 'Test', closable: false });
    modal.open();
    const closeBtn = document.body.querySelector('.dr-modal__close');
    expect(closeBtn).toBeFalsy();
    modal.destroy();
  });

  it('confirm() resolves true on confirm click', async () => {
    const promise = confirm('Are you sure?', { confirmLabel: 'Yes' });
    // Find and click the confirm button
    const confirmBtn = document.body.querySelector('.dr-dialog-btn--primary') as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    confirmBtn.click();
    const result = await promise;
    expect(result).toBe(true);
  });

  it('confirm() resolves false on cancel click', async () => {
    const promise = confirm('Are you sure?', { cancelLabel: 'No' });
    const cancelBtn = document.body.querySelector('.dr-dialog-btn--cancel') as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    cancelBtn.click();
    const result = await promise;
    expect(result).toBe(false);
  });

  it('onClose callback fires on close', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const modal = createModal({ content: 'Callback', onClose });
    modal.open();
    modal.close();
    vi.advanceTimersByTime(400);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
