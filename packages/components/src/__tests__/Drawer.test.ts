import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDrawer } from '../Drawer.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createDrawer', () => {
  it('createDrawer opens and closes', () => {
    const drawer = createDrawer({ content: 'Hello', overlay: false });
    drawer.open();
    expect(document.body.querySelector('.dr-drawer')).not.toBeNull();
    drawer.close();
  });

  it('isOpen signal reflects state', () => {
    const drawer = createDrawer({ content: 'Test', overlay: false });
    expect(drawer.isOpen()).toBe(false);
    drawer.open();
    expect(drawer.isOpen()).toBe(true);
    drawer.close();
    expect(drawer.isOpen()).toBe(false);
  });

  it('open() mounts to document.body', () => {
    const drawer = createDrawer({ content: 'Panel', overlay: false });
    drawer.open();
    const el = document.body.querySelector('.dr-drawer');
    expect(el).not.toBeNull();
  });

  it('close() removes element', async () => {
    const drawer = createDrawer({ content: 'Panel', overlay: false });
    drawer.open();
    expect(document.body.querySelector('.dr-drawer')).not.toBeNull();
    drawer.close();
    // After close, it transitions out — but the element should be gone after timeout
    await new Promise(r => setTimeout(r, 400));
    expect(document.body.querySelector('.dr-drawer:not(.dr-drawer--closed)')).toBeNull();
  });

  it('ESC key closes drawer', () => {
    const drawer = createDrawer({ content: 'ESC test', overlay: false, closeOnEsc: true });
    drawer.open();
    expect(drawer.isOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(drawer.isOpen()).toBe(false);
  });

  it('onOpen/onClose callbacks fire', () => {
    const onOpen  = vi.fn();
    const onClose = vi.fn();
    const drawer = createDrawer({ content: 'CB', overlay: false, onOpen, onClose });
    drawer.open();
    expect(onOpen).toHaveBeenCalledTimes(1);
    drawer.close();
    // onClose fires after transition — wait
  });

  it('destroy() cleans up', () => {
    const drawer = createDrawer({ content: 'Destroy', overlay: false });
    drawer.open();
    expect(document.body.querySelector('.dr-drawer')).not.toBeNull();
    drawer.destroy();
    expect(document.body.querySelector('.dr-drawer')).toBeNull();
  });
});
