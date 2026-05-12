// ── Drawer / Sheet component ───────────────────────────────────────────

import { signal } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

export interface DrawerOptions {
  side?:           'left' | 'right' | 'top' | 'bottom';
  size?:           string;
  title?:          string;
  content:         string | HTMLElement;
  overlay?:        boolean;
  closeOnOverlay?: boolean;
  closeOnEsc?:     boolean;
  onClose?:        () => void;
  onOpen?:         () => void;
}

export interface DrawerHandle {
  open():    void;
  close():   void;
  destroy(): void;
  readonly isOpen: Signal<boolean>;
}

// ── Style injection ────────────────────────────────────────────────────

function injectDrawerStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-drawer-styles')) return;
  const s = document.createElement('style');
  s.id = 'dr-drawer-styles';
  s.textContent = `
.dr-drawer-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 900;
  opacity: 0;
  transition: opacity 200ms ease;
}
.dr-drawer-overlay--visible { opacity: 1; }
.dr-drawer {
  position: fixed;
  background: var(--dr-color-surface, #0d0d1a);
  border: 1px solid var(--dr-color-border, rgba(255,255,255,.1));
  box-shadow: 0 24px 80px rgba(0,0,0,.6);
  z-index: 901;
  display: flex; flex-direction: column;
  transition: transform 250ms cubic-bezier(.4,0,.2,1);
}
.dr-drawer--right  { top:0; right:0; bottom:0; }
.dr-drawer--left   { top:0; left:0;  bottom:0; }
.dr-drawer--top    { top:0; left:0;  right:0; }
.dr-drawer--bottom { bottom:0; left:0; right:0; }
.dr-drawer--right.dr-drawer--closed  { transform: translateX(100%); }
.dr-drawer--left.dr-drawer--closed   { transform: translateX(-100%); }
.dr-drawer--top.dr-drawer--closed    { transform: translateY(-100%); }
.dr-drawer--bottom.dr-drawer--closed { transform: translateY(100%); }
.dr-drawer__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--dr-color-border, rgba(255,255,255,.08));
  flex-shrink: 0;
}
.dr-drawer__title {
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: 1rem; font-weight: 700;
  color: var(--dr-color-text, #e2e8f0); margin: 0;
}
.dr-drawer__close {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: transparent; border: none;
  color: var(--dr-color-text-muted, #64748b);
  cursor: pointer; transition: background 150ms, color 150ms; font-size: 1.2rem;
}
.dr-drawer__close:hover { background: rgba(255,255,255,.08); color: var(--dr-color-text, #e2e8f0); }
.dr-drawer__body {
  padding: 20px; flex: 1; overflow-y: auto;
  color: var(--dr-color-text, #e2e8f0);
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: .9rem; line-height: 1.65;
}
`;
  document.head.appendChild(s);
}

// ── Focus helpers ──────────────────────────────────────────────────────

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

// ── createDrawer ───────────────────────────────────────────────────────

export function createDrawer(opts: DrawerOptions): DrawerHandle {
  if (typeof document !== 'undefined') injectDrawerStyles();

  const side           = opts.side           ?? 'right';
  const size           = opts.size           ?? '320px';
  const overlay        = opts.overlay        ?? true;
  const closeOnOverlay = opts.closeOnOverlay ?? true;
  const closeOnEsc     = opts.closeOnEsc     ?? true;

  const isOpenSig = signal(false);
  let destroyed = false;
  let previousFocus: HTMLElement | null = null;

  // ── Overlay ──────────────────────────────────────────────────────────
  const overlayEl = document.createElement('div');
  overlayEl.className = 'dr-drawer-overlay';
  if (closeOnOverlay) {
    overlayEl.addEventListener('click', () => handle.close());
  }

  // ── Drawer panel ─────────────────────────────────────────────────────
  const drawer = document.createElement('div');
  drawer.className = `dr-drawer dr-drawer--${side} dr-drawer--closed`;
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');

  // Size
  if (side === 'left' || side === 'right') {
    drawer.style.width = size;
  } else {
    drawer.style.height = size;
  }

  // ── Title / header ────────────────────────────────────────────────────
  const titleId = `dr-drawer-title-${Math.random().toString(36).slice(2, 8)}`;
  if (opts.title !== undefined) {
    drawer.setAttribute('aria-labelledby', titleId);
    const header = document.createElement('div');
    header.className = 'dr-drawer__header';

    const titleEl = document.createElement('h2');
    titleEl.className = 'dr-drawer__title';
    titleEl.id = titleId;
    titleEl.textContent = opts.title;
    header.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dr-drawer__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => handle.close());
    header.appendChild(closeBtn);

    drawer.appendChild(header);
  }

  // ── Body ───────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'dr-drawer__body';
  if (typeof opts.content === 'string') {
    body.textContent = opts.content;
  } else {
    body.appendChild(opts.content);
  }
  drawer.appendChild(body);

  // ── Keyboard: ESC + focus trap ─────────────────────────────────────────
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEsc) {
      handle.close();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = getFocusable(drawer);
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0]!;
      const last  = focusable[focusable.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }
  };

  // ── Handle ────────────────────────────────────────────────────────────
  const handle: DrawerHandle = {
    get isOpen() { return isOpenSig; },

    open(): void {
      if (destroyed) return;
      previousFocus = document.activeElement as HTMLElement | null;

      if (overlay) {
        document.body.appendChild(overlayEl);
        // Trigger transition
        requestAnimationFrame(() => overlayEl.classList.add('dr-drawer-overlay--visible'));
      }
      document.body.appendChild(drawer);
      drawer.classList.remove('dr-drawer--closed');
      document.addEventListener('keydown', onKeydown);
      isOpenSig.set(true);

      requestAnimationFrame(() => {
        const focusable = getFocusable(drawer);
        focusable[0]?.focus();
      });

      opts.onOpen?.();
    },

    close(): void {
      if (destroyed) return;
      if (!isOpenSig.peek()) return;
      drawer.classList.add('dr-drawer--closed');
      overlayEl.classList.remove('dr-drawer-overlay--visible');
      document.removeEventListener('keydown', onKeydown);
      isOpenSig.set(false);

      // Remove after transition
      const cleanup = () => {
        drawer.remove();
        overlayEl.remove();
        previousFocus?.focus();
        opts.onClose?.();
      };
      drawer.addEventListener('transitionend', cleanup, { once: true });
      setTimeout(cleanup, 350);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('keydown', onKeydown);
      drawer.remove();
      overlayEl.remove();
    },
  };

  return handle;
}
