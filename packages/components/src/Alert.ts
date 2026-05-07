export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  title?:      string;
  message:     string | HTMLElement;
  variant?:    AlertVariant;
  icon?:       string | false;   // false = no icon
  dismissible?: boolean;
  onDismiss?:  () => void;
  actions?:    { label: string; onClick: () => void; primary?: boolean }[];
  class?:      string;
}

injectAlertStyles();

export function Alert(props: AlertProps): HTMLDivElement {
  const variant = props.variant ?? 'info';

  const el = document.createElement('div');
  el.className = `dr-alert dr-alert--${variant}${props.class ? ` ${props.class}` : ''}`;
  el.setAttribute('role', variant === 'danger' ? 'alert' : 'status');

  // Icon
  const iconHtml = props.icon === false ? '' : (props.icon ?? ALERT_ICONS[variant]);
  if (iconHtml) {
    const ic = document.createElement('span');
    ic.className = 'dr-alert__icon';
    ic.setAttribute('aria-hidden', 'true');
    ic.innerHTML = iconHtml;
    el.appendChild(ic);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'dr-alert__body';

  if (props.title) {
    const title = document.createElement('strong');
    title.className = 'dr-alert__title';
    title.textContent = props.title;
    body.appendChild(title);
  }

  const msg = document.createElement('div');
  msg.className = 'dr-alert__msg';
  if (typeof props.message === 'string') msg.textContent = props.message;
  else msg.appendChild(props.message);
  body.appendChild(msg);

  if (props.actions?.length) {
    const acts = document.createElement('div');
    acts.className = 'dr-alert__actions';
    props.actions.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dr-alert__action${a.primary ? ' dr-alert__action--primary' : ''}`;
      btn.textContent = a.label;
      btn.addEventListener('click', a.onClick);
      acts.appendChild(btn);
    });
    body.appendChild(acts);
  }

  el.appendChild(body);

  if (props.dismissible) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dr-alert__close';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
    close.addEventListener('click', () => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-4px)';
      el.addEventListener('transitionend', () => { el.remove(); props.onDismiss?.(); }, { once: true });
    });
    el.appendChild(close);
  }

  return el;
}

const ALERT_ICONS: Record<AlertVariant, string> = {
  info:    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
  success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
  warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
  danger:  `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
};

let _stylesInjected = false;
function injectAlertStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'alert';
  s.textContent = `
.dr-alert {
  display:flex; align-items:flex-start; gap:12px; padding:14px 16px;
  border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1));
  border:1px solid transparent; font-family:var(--dr-font-family,system-ui);
  transition: opacity calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease,
              transform calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease;
}
.dr-alert--info    { background:rgba(59,130,246,.1);  border-color:rgba(59,130,246,.25); }
.dr-alert--success { background:rgba(16,185,129,.1);  border-color:rgba(16,185,129,.25); }
.dr-alert--warning { background:rgba(245,158,11,.1);  border-color:rgba(245,158,11,.25); }
.dr-alert--danger  { background:rgba(244,63,94,.1);   border-color:rgba(244,63,94,.25); }
.dr-alert__icon { display:flex; flex-shrink:0; margin-top:1px; }
.dr-alert__icon svg { width:18px; height:18px; }
.dr-alert--info    .dr-alert__icon { color:#3b82f6; }
.dr-alert--success .dr-alert__icon { color:#10b981; }
.dr-alert--warning .dr-alert__icon { color:#f59e0b; }
.dr-alert--danger  .dr-alert__icon { color:#f43f5e; }
.dr-alert__body { flex:1; display:flex; flex-direction:column; gap:4px; }
.dr-alert__title { font-size:.875rem; font-weight:700; color:var(--dr-color-text,#e2e8f0); }
.dr-alert__msg { font-size:.85rem; color:rgba(226,232,240,.8); line-height:1.6; }
.dr-alert__actions { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
.dr-alert__action { background:transparent; border:1px solid currentColor; border-radius:5px; padding:3px 12px; font-size:.78rem; font-weight:600; font-family:inherit; cursor:pointer; opacity:.8; transition:opacity 150ms; }
.dr-alert__action:hover { opacity:1; }
.dr-alert__action--primary { background:currentColor; }
.dr-alert__action--primary span { color:var(--dr-color-surface,#0d0d1a); }
.dr-alert--info    .dr-alert__action { color:#3b82f6; }
.dr-alert--success .dr-alert__action { color:#10b981; }
.dr-alert--warning .dr-alert__action { color:#f59e0b; }
.dr-alert--danger  .dr-alert__action { color:#f43f5e; }
.dr-alert__close { display:flex; margin-left:auto; background:transparent; border:none; color:rgba(255,255,255,.4); cursor:pointer; padding:2px; border-radius:4px; transition:color 150ms; flex-shrink:0; }
.dr-alert__close:hover { color:rgba(255,255,255,.8); }
.dr-alert__close svg { width:16px; height:16px; }
`;
  document.head.appendChild(s);
}
