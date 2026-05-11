// ── Toast notification system ──────────────────────────────────────────
// Singleton manager with container mounting, dedup, max-5 cap, progress bar.

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message:   string;
  type?:     ToastType;    // default 'info'
  duration?: number;       // ms, default 4000. 0 = persistent
  title?:    string;
  action?:   { label: string; onClick: () => void };
  onClose?:  () => void;
  id?:       string;       // for dedup
}

export interface ToastHandle {
  dismiss(): void;
}

// ── Internal state ─────────────────────────────────────────────────────

type Position = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

let _container: HTMLElement | null = null;
let _position: Position = 'top-right';
const _toasts = new Map<string, { el: HTMLElement; dismiss: () => void }>();

const MAX_TOASTS = 5;

// ── Icons ──────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

// ── Style injection ────────────────────────────────────────────────────

function injectToastStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-toast-styles')) return;
  const s = document.createElement('style');
  s.id = 'dr-toast-styles';
  s.textContent = `
:root {
  --dr-toast-bg-success: #052920;
  --dr-toast-bg-error:   #1c0810;
  --dr-toast-bg-warning: #1c1405;
  --dr-toast-bg-info:    #0e1628;
  --dr-toast-border-success: rgba(16,185,129,.3);
  --dr-toast-border-error:   rgba(244,63,94,.3);
  --dr-toast-border-warning: rgba(245,158,11,.3);
  --dr-toast-border-info:    rgba(59,130,246,.3);
  --dr-toast-icon-success: #10b981;
  --dr-toast-icon-error:   #f43f5e;
  --dr-toast-icon-warning: #f59e0b;
  --dr-toast-icon-info:    #3b82f6;
}
.dr-toast-container {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
  max-width: min(380px, calc(100vw - 32px));
}
.dr-toast-container--top-right    { top: 20px; right: 20px; align-items: flex-end; }
.dr-toast-container--top-left     { top: 20px; left: 20px;  align-items: flex-start; }
.dr-toast-container--bottom-right { bottom: 20px; right: 20px; align-items: flex-end; flex-direction: column-reverse; }
.dr-toast-container--bottom-left  { bottom: 20px; left: 20px;  align-items: flex-start; flex-direction: column-reverse; }
.dr-toast-container--top-center   { top: 20px; left: 50%; transform: translateX(-50%); align-items: center; }
.dr-toast-container--bottom-center { bottom: 20px; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column-reverse; }
@keyframes dr-toast-slide-in-right  { from { opacity:0; transform:translateX(110%); } to { opacity:1; transform:translateX(0); } }
@keyframes dr-toast-slide-in-left   { from { opacity:0; transform:translateX(-110%); } to { opacity:1; transform:translateX(0); } }
@keyframes dr-toast-slide-in-top    { from { opacity:0; transform:translateY(-40px); } to { opacity:1; transform:translateY(0); } }
@keyframes dr-toast-slide-out-right { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(110%); } }
@keyframes dr-toast-slide-out-left  { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(-110%); } }
@keyframes dr-toast-slide-out-top   { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-40px); } }
@keyframes dr-toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.dr-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: .85rem;
  line-height: 1.5;
  box-shadow: 0 8px 32px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3);
  pointer-events: all;
  position: relative;
  overflow: hidden;
  min-width: 260px;
}
.dr-toast--enter-right  { animation: dr-toast-slide-in-right  240ms cubic-bezier(.34,1.56,.64,1) both; }
.dr-toast--enter-left   { animation: dr-toast-slide-in-left   240ms cubic-bezier(.34,1.56,.64,1) both; }
.dr-toast--enter-center { animation: dr-toast-slide-in-top    240ms cubic-bezier(.34,1.56,.64,1) both; }
.dr-toast--exit-right   { animation: dr-toast-slide-out-right 180ms ease-in both; }
.dr-toast--exit-left    { animation: dr-toast-slide-out-left  180ms ease-in both; }
.dr-toast--exit-center  { animation: dr-toast-slide-out-top   180ms ease-in both; }
.dr-toast--success { background: var(--dr-toast-bg-success); border-color: var(--dr-toast-border-success); color: #e2e8f0; }
.dr-toast--error   { background: var(--dr-toast-bg-error);   border-color: var(--dr-toast-border-error);   color: #e2e8f0; }
.dr-toast--warning { background: var(--dr-toast-bg-warning); border-color: var(--dr-toast-border-warning); color: #e2e8f0; }
.dr-toast--info    { background: var(--dr-toast-bg-info);    border-color: var(--dr-toast-border-info);    color: #e2e8f0; }
.dr-toast__icon {
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 1rem; margin-top: 1px; width: 20px;
}
.dr-toast--success .dr-toast__icon { color: var(--dr-toast-icon-success); }
.dr-toast--error   .dr-toast__icon { color: var(--dr-toast-icon-error); }
.dr-toast--warning .dr-toast__icon { color: var(--dr-toast-icon-warning); }
.dr-toast--info    .dr-toast__icon { color: var(--dr-toast-icon-info); }
.dr-toast__body  { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.dr-toast__title { font-weight: 700; font-size: .875rem; color: #e2e8f0; }
.dr-toast__msg   { color: rgba(255,255,255,.75); }
.dr-toast__action {
  flex-shrink: 0; background: transparent;
  border: 1px solid rgba(255,255,255,.2); border-radius: 4px;
  color: inherit; font-size: .75rem; font-family: inherit;
  font-weight: 600; padding: 3px 10px; cursor: pointer;
  align-self: center; white-space: nowrap;
}
.dr-toast__action:hover { background: rgba(255,255,255,.1); }
.dr-toast__close {
  flex-shrink: 0; background: transparent; border: none;
  color: rgba(255,255,255,.4); font-size: 1.1rem; line-height: 1;
  cursor: pointer; padding: 0; width: 20px; text-align: center;
  align-self: flex-start;
}
.dr-toast__close:hover { color: rgba(255,255,255,.8); }
.dr-toast__progress {
  position: absolute; bottom: 0; left: 0; height: 2px;
  background: currentColor; opacity: .35;
  animation: dr-toast-progress linear forwards;
  transform-origin: left;
}
`;
  document.head.appendChild(s);
}

// ── Container management ───────────────────────────────────────────────

function getEnterClass(): string {
  if (_position.endsWith('left')) return 'dr-toast--enter-left';
  if (_position.includes('center')) return 'dr-toast--enter-center';
  return 'dr-toast--enter-right';
}

function getExitClass(): string {
  if (_position.endsWith('left')) return 'dr-toast--exit-left';
  if (_position.includes('center')) return 'dr-toast--exit-center';
  return 'dr-toast--exit-right';
}

function getContainer(): HTMLElement {
  if (_container && _container.isConnected) return _container;
  injectToastStyles();
  const el = document.createElement('div');
  el.className = `dr-toast-container dr-toast-container--${_position}`;
  el.setAttribute('aria-label', 'Notifications');
  document.body.appendChild(el);
  _container = el;
  return el;
}

// ── Cap enforcement ────────────────────────────────────────────────────

function enforceCap(): void {
  if (_toasts.size >= MAX_TOASTS) {
    // dismiss the oldest (first entry in map)
    const firstEntry = _toasts.entries().next().value;
    if (firstEntry) {
      const [, oldest] = firstEntry as [string, { el: HTMLElement; dismiss: () => void }];
      oldest.dismiss();
    }
  }
}

// ── Core show ──────────────────────────────────────────────────────────

function showToast(opts: ToastOptions): ToastHandle {
  if (typeof document === 'undefined') return { dismiss: () => {} };

  const type     = opts.type ?? 'info';
  const duration = opts.duration === undefined ? 4000 : opts.duration;
  const id       = opts.id ?? `dr-toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Dedup: if same id already shown, dismiss the old one first
  if (opts.id && _toasts.has(opts.id)) {
    _toasts.get(opts.id)!.dismiss();
  }

  // Enforce max 5
  enforceCap();

  const container = getContainer();

  const el = document.createElement('div');
  el.id        = id;
  el.className = `dr-toast dr-toast--${type} ${getEnterClass()}`;
  el.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
  el.setAttribute('aria-atomic', 'true');

  // Icon
  const icon = document.createElement('span');
  icon.className = 'dr-toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ICONS[type];
  el.appendChild(icon);

  // Body
  const body = document.createElement('div');
  body.className = 'dr-toast__body';
  if (opts.title) {
    const titleEl = document.createElement('strong');
    titleEl.className = 'dr-toast__title';
    titleEl.textContent = opts.title;
    body.appendChild(titleEl);
  }
  const msg = document.createElement('span');
  msg.className = 'dr-toast__msg';
  msg.textContent = opts.message;
  body.appendChild(msg);
  el.appendChild(body);

  // Action
  if (opts.action) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'dr-toast__action';
    actionBtn.textContent = opts.action.label;
    const actionHandler = opts.action;
    actionBtn.addEventListener('click', () => { actionHandler.onClick(); dismiss(); });
    el.appendChild(actionBtn);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dr-toast__close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => dismiss());
  el.appendChild(closeBtn);

  // Progress bar
  if (duration > 0) {
    const prog = document.createElement('div');
    prog.className = 'dr-toast__progress';
    prog.style.animationDuration = `${duration}ms`;
    el.appendChild(prog);
  }

  container.appendChild(el);

  let timer: ReturnType<typeof setTimeout> | null = null;
  if (duration > 0) {
    timer = setTimeout(() => dismiss(), duration);
  }

  let dismissed = false;
  function dismiss(): void {
    if (dismissed) return;
    dismissed = true;
    if (timer !== null) clearTimeout(timer);
    _toasts.delete(id);
    const exitClass = getExitClass();
    el.classList.add(exitClass);
    const onAnimEnd = () => {
      el.remove();
      opts.onClose?.();
    };
    el.addEventListener('animationend', onAnimEnd, { once: true });
    // Fallback if animation doesn't fire (e.g. jsdom)
    setTimeout(onAnimEnd, 300);
  }

  _toasts.set(id, { el, dismiss });

  return { dismiss };
}

// ── Public singleton ───────────────────────────────────────────────────

export const toast = {
  show(opts: ToastOptions): ToastHandle {
    return showToast(opts);
  },
  success(message: string, opts?: Partial<ToastOptions>): ToastHandle {
    return showToast({ ...opts, message, type: 'success' });
  },
  error(message: string, opts?: Partial<ToastOptions>): ToastHandle {
    return showToast({ ...opts, message, type: 'error' });
  },
  warning(message: string, opts?: Partial<ToastOptions>): ToastHandle {
    return showToast({ ...opts, message, type: 'warning' });
  },
  info(message: string, opts?: Partial<ToastOptions>): ToastHandle {
    return showToast({ ...opts, message, type: 'info' });
  },
  dismiss(id: string): void {
    _toasts.get(id)?.dismiss();
  },
  dismissAll(): void {
    for (const [, entry] of _toasts) {
      entry.dismiss();
    }
    // Map is cleared by individual dismiss calls
  },
};

// ── Mount helper ───────────────────────────────────────────────────────

export function mountToastContainer(opts?: { position?: Position }): void {
  if (opts?.position) {
    _position = opts.position;
  }
  // Remove old container if position changed
  if (_container && _container.isConnected) {
    _container.remove();
    _container = null;
  }
  getContainer();
}
