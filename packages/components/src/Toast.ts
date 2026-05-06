// ── Toast notification system ──────────────────────────────────────────
// Singleton manager. Use the exported `toast` object anywhere in your app.
// Genome-aware: uses --dr-* CSS variables.

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  message:   string;
  title?:    string;
  variant?:  ToastVariant;
  duration?: number;  // ms before auto-dismiss, 0 = permanent
  action?:   { label: string; onClick: () => void };
}

export type ToastDismiss = () => void;

injectToastStyles();

class ToastManager {
  private _container: HTMLElement | null = null;
  private _toasts    = new Map<string, HTMLElement>();

  private _getContainer(): HTMLElement {
    if (this._container && this._container.isConnected) return this._container;
    const el = document.createElement('div');
    el.className = 'dr-toast-container';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Notifications');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    this._container = el;
    return el;
  }

  show(opts: ToastOptions): ToastDismiss {
    const id      = `dr-toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const variant = opts.variant ?? 'info';
    const duration = opts.duration === undefined ? 4500 : opts.duration;

    const el = document.createElement('div');
    el.id        = id;
    el.className = `dr-toast dr-toast--${variant}`;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-atomic', 'true');

    // Icon
    const icon = document.createElement('span');
    icon.className = 'dr-toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = ICONS[variant];
    el.appendChild(icon);

    // Body
    const body = document.createElement('div');
    body.className = 'dr-toast__body';
    if (opts.title) {
      const title = document.createElement('strong');
      title.className = 'dr-toast__title';
      title.textContent = opts.title;
      body.appendChild(title);
    }
    const msg = document.createElement('span');
    msg.className = 'dr-toast__msg';
    msg.textContent = opts.message;
    body.appendChild(msg);
    el.appendChild(body);

    // Action
    if (opts.action) {
      const btn = document.createElement('button');
      btn.className = 'dr-toast__action';
      btn.textContent = opts.action.label;
      btn.addEventListener('click', () => { opts.action!.onClick(); dismiss(); });
      el.appendChild(btn);
    }

    // Dismiss button
    const close = document.createElement('button');
    close.className = 'dr-toast__close';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '&times;';
    close.addEventListener('click', () => dismiss());
    el.appendChild(close);

    // Progress bar
    if (duration > 0) {
      const prog = document.createElement('div');
      prog.className = 'dr-toast__progress';
      prog.style.animationDuration = `${duration}ms`;
      el.appendChild(prog);
    }

    this._toasts.set(id, el);
    const container = this._getContainer();

    // Animate in
    el.style.setProperty('--dr-toast-enter', '1');
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('dr-toast--visible'));

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (duration > 0) {
      timer = setTimeout(() => dismiss(), duration);
    }

    const dismiss: ToastDismiss = () => {
      if (timer) clearTimeout(timer);
      el.classList.remove('dr-toast--visible');
      el.classList.add('dr-toast--exit');
      el.addEventListener('animationend', () => {
        el.remove();
        this._toasts.delete(id);
      }, { once: true });
    };

    return dismiss;
  }

  success(message: string, title?: string): ToastDismiss {
    return this.show({ message, ...(title !== undefined ? { title } : {}), variant: 'success' });
  }

  error(message: string, title?: string): ToastDismiss {
    return this.show({ message, ...(title !== undefined ? { title } : {}), variant: 'error', duration: 6000 });
  }

  warning(message: string, title?: string): ToastDismiss {
    return this.show({ message, ...(title !== undefined ? { title } : {}), variant: 'warning' });
  }

  info(message: string, title?: string): ToastDismiss {
    return this.show({ message, ...(title !== undefined ? { title } : {}), variant: 'info' });
  }

  dismissAll(): void {
    for (const [, el] of this._toasts) {
      el.classList.remove('dr-toast--visible');
      el.classList.add('dr-toast--exit');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
    this._toasts.clear();
  }
}

export const toast = new ToastManager();

// ── Icons ──────────────────────────────────────────────────────────────

const ICONS: Record<ToastVariant, string> = {
  info:    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
  success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
  warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
  error:   `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
};

// ── Styles ─────────────────────────────────────────────────────────────

let _stylesInjected = false;
function injectToastStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;

  const s = document.createElement('style');
  s.dataset['drComponent'] = 'toast';
  s.textContent = `
.dr-toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column-reverse;
  gap: 10px;
  pointer-events: none;
  max-width: min(380px, calc(100vw - 48px));
}
.dr-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: calc(var(--dr-border-radius, 8px) * var(--dr-adapt-radius, 1));
  border: 1px solid transparent;
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: .85rem;
  line-height: 1.5;
  box-shadow: 0 8px 32px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3);
  pointer-events: all;
  position: relative;
  overflow: hidden;
  opacity: 0;
  transform: translateX(110%);
  transition:
    opacity    calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1) * 0.8) ease,
    transform  calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1) * 0.8) cubic-bezier(.34,1.56,.64,1);
}
.dr-toast--visible {
  opacity: 1;
  transform: translateX(0);
}
.dr-toast--exit {
  opacity: 0;
  transform: translateX(110%);
}
.dr-toast--info    { background: rgba(14,22,40,.92);    border-color: rgba(59,130,246,.3);  color: #e2e8f0; }
.dr-toast--success { background: rgba(5,28,20,.92);     border-color: rgba(16,185,129,.3);  color: #e2e8f0; }
.dr-toast--warning { background: rgba(28,20,5,.92);     border-color: rgba(245,158,11,.3);  color: #e2e8f0; }
.dr-toast--error   { background: rgba(28,8,16,.92);     border-color: rgba(244,63,94,.3);   color: #e2e8f0; }
.dr-toast__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-top: 1px;
}
.dr-toast__icon svg { width: 18px; height: 18px; }
.dr-toast--info    .dr-toast__icon { color: #3b82f6; }
.dr-toast--success .dr-toast__icon { color: #10b981; }
.dr-toast--warning .dr-toast__icon { color: #f59e0b; }
.dr-toast--error   .dr-toast__icon { color: #f43f5e; }
.dr-toast__body    { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.dr-toast__title   { font-weight: 700; font-size: .875rem; }
.dr-toast__msg     { color: rgba(255,255,255,.7); }
.dr-toast__action {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 4px;
  color: inherit;
  font-size: .75rem;
  font-family: inherit;
  font-weight: 600;
  padding: 3px 10px;
  cursor: pointer;
  align-self: center;
  white-space: nowrap;
}
.dr-toast__action:hover { background: rgba(255,255,255,.1); }
.dr-toast__close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: rgba(255,255,255,.4);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 20px;
  text-align: center;
  align-self: flex-start;
}
.dr-toast__close:hover { color: rgba(255,255,255,.8); }
.dr-toast__progress {
  position: absolute;
  bottom: 0; left: 0;
  height: 2px;
  background: currentColor;
  opacity: .35;
  animation: dr-toast-progress linear forwards;
  transform-origin: left;
}
@keyframes dr-toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
`;
  document.head.appendChild(s);
}
