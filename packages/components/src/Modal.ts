import { signal, effect } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  title:      string | Signal<string>;
  content:    HTMLElement | ((close: () => void) => HTMLElement);
  open?:      Signal<boolean>;
  size?:      ModalSize;
  closable?:  boolean;       // show X button and allow backdrop click (default true)
  onClose?:   () => void;
  onOpen?:    () => void;
  class?:     string;
}

injectModalStyles();

export interface ModalHandle {
  el:      HTMLElement;   // the backdrop element
  open():  void;
  close(): void;
  toggle():void;
  readonly isOpen: Signal<boolean>;
}

export function Modal(props: ModalProps): ModalHandle {
  const closable  = props.closable ?? true;
  const _open     = props.open ?? signal(false);

  // ── Backdrop ───────────────────────────────────────────────────────
  const backdrop = document.createElement('div');
  backdrop.className = 'dr-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  if (props.class) backdrop.classList.add(props.class);

  // ── Panel ──────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.className = `dr-modal dr-modal--${props.size ?? 'md'}`;
  backdrop.appendChild(panel);

  // ── Header ─────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'dr-modal__header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'dr-modal__title';
  titleEl.id = `dr-modal-title-${Math.random().toString(36).slice(2, 8)}`;
  backdrop.setAttribute('aria-labelledby', titleEl.id);
  header.appendChild(titleEl);

  if (typeof props.title === 'function') {
    effect(() => { titleEl.textContent = (props.title as Signal<string>)(); });
  } else {
    titleEl.textContent = props.title;
  }

  if (closable) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dr-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
  }

  panel.appendChild(header);

  // ── Body ───────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'dr-modal__body';
  const contentEl = typeof props.content === 'function'
    ? props.content(close)
    : props.content;
  body.appendChild(contentEl);
  panel.appendChild(body);

  // ── Backdrop click ─────────────────────────────────────────────────
  if (closable) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }

  // ── Keyboard ───────────────────────────────────────────────────────
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && closable) close();
  };

  // ── Open/close state ───────────────────────────────────────────────
  effect(() => {
    const isOpen = _open();
    if (isOpen) {
      if (!backdrop.isConnected) document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add('dr-modal-backdrop--visible'));
      document.addEventListener('keydown', onKeydown);
      // Trap scroll
      document.body.style.overflow = 'hidden';
      props.onOpen?.();
    } else {
      backdrop.classList.remove('dr-modal-backdrop--visible');
      document.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = '';
      backdrop.addEventListener('transitionend', () => {
        if (!_open.peek()) backdrop.remove();
      }, { once: true });
      props.onClose?.();
    }
  });

  function open():   void { _open.set(true);  }
  function close():  void { _open.set(false); }
  function toggle(): void { _open.set(!_open.peek()); }

  return { el: backdrop, open, close, toggle, isOpen: _open };
}

// ── Styles ─────────────────────────────────────────────────────────────

let _stylesInjected = false;
function injectModalStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;

  const s = document.createElement('style');
  s.dataset['drComponent'] = 'modal';
  s.textContent = `
.dr-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0,0,0,.7);
  backdrop-filter: blur(calc(4px * var(--dr-adapt-blur, 1)));
  -webkit-backdrop-filter: blur(calc(4px * var(--dr-adapt-blur, 1)));
  opacity: 0;
  transition:
    opacity calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1) * 0.7) ease;
}
.dr-modal-backdrop--visible { opacity: 1; }
.dr-modal {
  position: relative;
  background: var(--dr-color-surface, #0d0d1a);
  border: 1px solid var(--dr-color-border, rgba(255,255,255,.1));
  border-radius: calc(var(--dr-border-radius, 8px) * var(--dr-adapt-radius, 1) * 1.5);
  box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 8px 24px rgba(0,0,0,.4);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  transform: translateY(20px) scale(.97);
  transition:
    transform calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1)) cubic-bezier(.34,1.56,.64,1);
}
.dr-modal-backdrop--visible .dr-modal {
  transform: translateY(0) scale(1);
}
.dr-modal--sm   { width: min(380px, 100%); }
.dr-modal--md   { width: min(520px, 100%); }
.dr-modal--lg   { width: min(720px, 100%); }
.dr-modal--xl   { width: min(960px, 100%); }
.dr-modal--full { width: 100%; max-height: 100%; }
.dr-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--dr-color-border, rgba(255,255,255,.08));
  flex-shrink: 0;
}
.dr-modal__title {
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--dr-color-text, #e2e8f0);
  margin: 0;
}
.dr-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--dr-color-text-muted, #64748b);
  cursor: pointer;
  transition: background 150ms, color 150ms;
  flex-shrink: 0;
}
.dr-modal__close:hover { background: rgba(255,255,255,.08); color: var(--dr-color-text, #e2e8f0); }
.dr-modal__close svg { width: 16px; height: 16px; }
.dr-modal__body {
  padding: 20px 24px 24px;
  flex: 1;
  overflow-y: auto;
  color: var(--dr-color-text, #e2e8f0);
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: .9rem;
  line-height: 1.65;
}
`;
  document.head.appendChild(s);
}
