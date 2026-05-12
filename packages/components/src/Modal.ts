// ── Modal / Dialog component ───────────────────────────────────────────
// Accessible, focus-trapped, stacking modals.

import { signal } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

export interface ModalOptions {
  title?:           string;
  content:          string | HTMLElement;
  footer?:          HTMLElement;
  size?:            'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';  // default 'md'
  closable?:        boolean;   // show X button, default true
  closeOnBackdrop?: boolean;   // default true
  closeOnEsc?:      boolean;   // default true
  onClose?:         () => void;
  onOpen?:          () => void;
  zIndex?:          number;
}

export interface ModalHandle {
  open():   void;
  close():  void;
  destroy(): void;
  readonly isOpen: Signal<boolean>;
}

// ── Style injection ────────────────────────────────────────────────────

function injectModalStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-modal-styles')) return;
  const s = document.createElement('style');
  s.id = 'dr-modal-styles';
  s.textContent = `
@keyframes dr-modal-fade-in  { from { opacity:0; }  to { opacity:1; } }
@keyframes dr-modal-fade-out { from { opacity:1; }  to { opacity:0; } }
@keyframes dr-modal-slide-in { from { opacity:0; transform:translateY(-24px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes dr-modal-slide-out { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(-24px) scale(.96); } }
.dr-modal-backdrop {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(0,0,0,.7);
  animation: dr-modal-fade-in 200ms ease both;
}
.dr-modal-backdrop--closing { animation: dr-modal-fade-out 160ms ease both; }
.dr-modal {
  position: relative;
  background: var(--dr-color-surface, #0d0d1a);
  border: 1px solid var(--dr-color-border, rgba(255,255,255,.1));
  border-radius: 12px;
  box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 8px 24px rgba(0,0,0,.4);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  display: flex; flex-direction: column;
  animation: dr-modal-slide-in 220ms cubic-bezier(.34,1.56,.64,1) both;
}
.dr-modal-backdrop--closing .dr-modal { animation: dr-modal-slide-out 160ms ease both; }
.dr-modal--sm         { width: min(380px, 100%); }
.dr-modal--md         { width: min(520px, 100%); }
.dr-modal--lg         { width: min(720px, 100%); }
.dr-modal--xl         { width: min(960px, 100%); }
.dr-modal--fullscreen { width: 100%; max-height: 100vh; border-radius: 0; }
.dr-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--dr-color-border, rgba(255,255,255,.08));
  flex-shrink: 0;
}
.dr-modal__title {
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: 1.05rem; font-weight: 700;
  color: var(--dr-color-text, #e2e8f0); margin: 0;
}
.dr-modal__close {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: transparent; border: none;
  color: var(--dr-color-text-muted, #64748b);
  cursor: pointer; transition: background 150ms, color 150ms; flex-shrink: 0;
  font-size: 1.2rem;
}
.dr-modal__close:hover { background: rgba(255,255,255,.08); color: var(--dr-color-text, #e2e8f0); }
.dr-modal__body {
  padding: 20px 24px 24px; flex: 1; overflow-y: auto;
  color: var(--dr-color-text, #e2e8f0);
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: .9rem; line-height: 1.65;
}
.dr-modal__footer {
  padding: 12px 24px 20px;
  border-top: 1px solid var(--dr-color-border, rgba(255,255,255,.08));
  display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0;
}
/* Confirm/Alert dialogs */
.dr-confirm-msg { margin: 0; color: var(--dr-color-text, #e2e8f0); font-size: .95rem; line-height: 1.6; }
.dr-dialog-btn {
  padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer;
  font-family: var(--dr-font-family, system-ui); font-size: .875rem; font-weight: 600;
  transition: background 150ms;
}
.dr-dialog-btn--primary {
  background: var(--dr-color-primary, #3b82f6); color: #fff;
}
.dr-dialog-btn--primary:hover { filter: brightness(1.1); }
.dr-dialog-btn--cancel {
  background: rgba(255,255,255,.08); color: var(--dr-color-text, #e2e8f0);
}
.dr-dialog-btn--cancel:hover { background: rgba(255,255,255,.14); }
`;
  document.head.appendChild(s);
}

// ── Z-index management ─────────────────────────────────────────────────

let _baseZIndex = 1000;
let _modalCount = 0;

function nextZIndex(): number {
  _modalCount++;
  return _baseZIndex + _modalCount * 10;
}

// ── Focusable elements query ───────────────────────────────────────────

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

// ── createModal ────────────────────────────────────────────────────────

export function createModal(opts: ModalOptions): ModalHandle {
  if (typeof document !== 'undefined') {
    injectModalStyles();
  }

  const closable        = opts.closable        ?? true;
  const closeOnBackdrop = opts.closeOnBackdrop  ?? true;
  const closeOnEsc      = opts.closeOnEsc       ?? true;
  const size            = opts.size             ?? 'md';

  const isOpenSig = signal(false);

  let previousFocus: HTMLElement | null = null;
  let destroyed = false;

  // ── Backdrop ─────────────────────────────────────────────────────────
  const backdrop = document.createElement('div');
  backdrop.className = 'dr-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  const zIdx = opts.zIndex ?? nextZIndex();
  backdrop.style.zIndex = String(zIdx);

  // ── Panel ─────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.className = `dr-modal dr-modal--${size}`;
  backdrop.appendChild(panel);

  // ── Header ────────────────────────────────────────────────────────────
  const titleId = `dr-modal-title-${Math.random().toString(36).slice(2, 8)}`;
  if (opts.title) {
    backdrop.setAttribute('aria-labelledby', titleId);
    const header = document.createElement('div');
    header.className = 'dr-modal__header';

    const titleEl = document.createElement('h2');
    titleEl.className = 'dr-modal__title';
    titleEl.id = titleId;
    titleEl.textContent = opts.title;
    header.appendChild(titleEl);

    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'dr-modal__close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => handle.close());
      header.appendChild(closeBtn);
    }

    panel.appendChild(header);
  } else if (closable) {
    // No title but closable: add close button in header
    const header = document.createElement('div');
    header.className = 'dr-modal__header';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dr-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => handle.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);
  }

  // ── Body ──────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'dr-modal__body';
  if (typeof opts.content === 'string') {
    const p = document.createElement('p');
    p.textContent = opts.content;
    body.appendChild(p);
  } else {
    body.appendChild(opts.content);
  }
  panel.appendChild(body);

  // ── Footer ────────────────────────────────────────────────────────────
  if (opts.footer) {
    const footer = document.createElement('div');
    footer.className = 'dr-modal__footer';
    footer.appendChild(opts.footer);
    panel.appendChild(footer);
  }

  // ── Backdrop click ────────────────────────────────────────────────────
  if (closeOnBackdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) handle.close();
    });
  }

  // ── Keyboard: ESC + focus trap ────────────────────────────────────────
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEsc) {
      handle.close();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = getFocusable(panel);
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0] as HTMLElement;
      const last  = focusable[focusable.length - 1] as HTMLElement;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }
  };

  // ── Handle ────────────────────────────────────────────────────────────
  const handle: ModalHandle = {
    get isOpen() { return isOpenSig; },

    open(): void {
      if (destroyed) return;
      previousFocus = document.activeElement as HTMLElement | null;
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown);
      isOpenSig.set(true);
      // Focus first focusable element
      requestAnimationFrame(() => {
        const focusable = getFocusable(panel);
        focusable[0]?.focus();
      });
      opts.onOpen?.();
    },

    close(): void {
      if (destroyed) return;
      if (!isOpenSig.peek()) return;
      isOpenSig.set(false);
      document.removeEventListener('keydown', onKeydown);

      // Animate out
      backdrop.classList.add('dr-modal-backdrop--closing');
      const onDone = () => {
        if (backdrop.isConnected) backdrop.remove();
        document.body.style.overflow = '';
        previousFocus?.focus();
        opts.onClose?.();
      };
      backdrop.addEventListener('animationend', onDone, { once: true });
      // Fallback for jsdom
      setTimeout(onDone, 300);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      handle.close();
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
    },
  };

  return handle;
}

// ── confirm ────────────────────────────────────────────────────────────

export function confirm(
  message: string,
  opts?: { title?: string; confirmLabel?: string; cancelLabel?: string },
): Promise<boolean> {
  injectModalStyles();
  return new Promise<boolean>((resolve) => {
    const footer = document.createElement('div');

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dr-dialog-btn dr-dialog-btn--cancel';
    cancelBtn.textContent = opts?.cancelLabel ?? 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'dr-dialog-btn dr-dialog-btn--primary';
    confirmBtn.textContent = opts?.confirmLabel ?? 'Confirm';

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    const contentEl = document.createElement('p');
    contentEl.className = 'dr-confirm-msg';
    contentEl.textContent = message;

    let resolved = false;
    const modalOpts: ModalOptions = {
      content: contentEl,
      footer,
      size:    'sm',
      closable: true,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      },
    };
    if (opts?.title !== undefined) modalOpts.title = opts.title;
    const modal = createModal(modalOpts);

    cancelBtn.addEventListener('click', () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
      modal.destroy();
    });

    confirmBtn.addEventListener('click', () => {
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
      modal.destroy();
    });

    modal.open();
  });
}

// ── alert ──────────────────────────────────────────────────────────────

export function alert(
  message: string,
  opts?: { title?: string; buttonLabel?: string },
): Promise<void> {
  injectModalStyles();
  return new Promise<void>((resolve) => {
    const footer = document.createElement('div');

    const okBtn = document.createElement('button');
    okBtn.className = 'dr-dialog-btn dr-dialog-btn--primary';
    okBtn.textContent = opts?.buttonLabel ?? 'OK';

    footer.appendChild(okBtn);

    const contentEl = document.createElement('p');
    contentEl.className = 'dr-confirm-msg';
    contentEl.textContent = message;

    let resolved = false;
    const alertOpts: ModalOptions = {
      content: contentEl,
      footer,
      size:    'sm',
      closable: true,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      },
    };
    if (opts?.title !== undefined) alertOpts.title = opts.title;
    const modal = createModal(alertOpts);

    okBtn.addEventListener('click', () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
      modal.destroy();
    });

    modal.open();
  });
}
