import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTooltip, createPopover } from '../Tooltip.js';

describe('Tooltip', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('createTooltip attaches to target element', () => {
    const target = document.createElement('button');
    target.textContent = 'Hover me';
    document.body.appendChild(target);
    const tt = createTooltip(target, { content: 'Tooltip text', trigger: 'manual' });
    expect(tt).toBeTruthy();
    tt.destroy();
  });

  it('show() makes tooltip visible', () => {
    const target = document.createElement('button');
    document.body.appendChild(target);
    const tt = createTooltip(target, { content: 'Hello', trigger: 'manual', delay: 0 });
    tt.show();
    vi.runAllTimers();
    const tip = document.querySelector('.dr-tooltip');
    expect(tip).toBeTruthy();
    tt.destroy();
  });

  it('hide() hides tooltip', () => {
    const target = document.createElement('button');
    document.body.appendChild(target);
    const tt = createTooltip(target, { content: 'Hello', trigger: 'manual', delay: 0, hideDelay: 0 });
    tt.show();
    vi.runAllTimers();
    expect(document.querySelector('.dr-tooltip')).toBeTruthy();
    tt.hide();
    vi.runAllTimers();
    const tip = document.querySelector('.dr-tooltip');
    expect(!tip || !tip.isConnected).toBe(true);
    tt.destroy();
  });

  it('trigger=manual: show/hide only via API', () => {
    const target = document.createElement('button');
    document.body.appendChild(target);
    const tt = createTooltip(target, { content: 'Manual', trigger: 'manual', delay: 0 });
    target.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    expect(document.querySelector('.dr-tooltip')).toBeFalsy();
    tt.show();
    vi.runAllTimers();
    expect(document.querySelector('.dr-tooltip')).toBeTruthy();
    tt.destroy();
  });

  it('destroy() removes tooltip element', () => {
    const target = document.createElement('button');
    document.body.appendChild(target);
    const tt = createTooltip(target, { content: 'Bye', trigger: 'manual', delay: 0, hideDelay: 0 });
    tt.show();
    vi.runAllTimers();
    expect(document.querySelector('.dr-tooltip')).toBeTruthy();
    tt.destroy();
    vi.runAllTimers(); // flush removal timer
    const tip = document.querySelector('.dr-tooltip');
    expect(!tip || !tip.isConnected).toBe(true);
  });

  it('createPopover adds title when provided', () => {
    const target = document.createElement('button');
    document.body.appendChild(target);
    const pop = createPopover(target, { content: 'Body text', title: 'My Popover', trigger: 'manual', delay: 0 });
    pop.show();
    vi.runAllTimers();
    const popEl = document.querySelector('.dr-popover');
    expect(popEl?.textContent).toContain('My Popover');
    pop.destroy();
  });
});
