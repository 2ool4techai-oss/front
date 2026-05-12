import { effect } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label:     string | Signal<string>;
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  disabled?: boolean | Signal<boolean>;
  loading?:  boolean | Signal<boolean>;
  icon?:     string;           // SVG/HTML string, rendered before label
  iconRight?:string;           // SVG/HTML string, rendered after label
  type?:     'button' | 'submit' | 'reset';
  onClick?:  (e: MouseEvent) => void;
  class?:    string;
}

let _stylesInjected = false;
injectButtonStyles();

export function Button(props: ButtonProps): HTMLButtonElement {
  const {
    variant = 'primary',
    size    = 'md',
    type    = 'button',
  } = props;

  const btn = document.createElement('button');
  btn.type = type;
  btn.className = `dr-btn dr-btn--${variant} dr-btn--${size}${props.class ? ` ${props.class}` : ''}`;

  // Icon left
  let iconEl: HTMLSpanElement | null = null;
  if (props.icon) {
    iconEl = document.createElement('span');
    iconEl.className = 'dr-btn__icon';
    iconEl.innerHTML = props.icon;
    btn.appendChild(iconEl);
  }

  // Spinner (shown when loading)
  const spinner = document.createElement('span');
  spinner.className = 'dr-btn__spinner';
  spinner.innerHTML = spinnerSVG;
  btn.appendChild(spinner);

  // Label
  const labelNode = document.createTextNode('');
  const labelEl = document.createElement('span');
  labelEl.className = 'dr-btn__label';
  labelEl.appendChild(labelNode);
  btn.appendChild(labelEl);

  // Icon right
  if (props.iconRight) {
    const ir = document.createElement('span');
    ir.className = 'dr-btn__icon dr-btn__icon--right';
    ir.innerHTML = props.iconRight;
    btn.appendChild(ir);
  }

  // Reactive label
  if (typeof props.label === 'function') {
    effect(() => { labelNode.textContent = (props.label as Signal<string>)(); });
  } else {
    labelNode.textContent = props.label;
  }

  // Reactive disabled
  const setDisabled = (v: boolean) => {
    btn.disabled = v;
    btn.setAttribute('aria-disabled', String(v));
    btn.classList.toggle('dr-btn--disabled', v);
  };
  if (typeof props.disabled === 'function') {
    effect(() => setDisabled((props.disabled as Signal<boolean>)()));
  } else {
    setDisabled(props.disabled ?? false);
  }

  // Reactive loading
  const setLoading = (v: boolean) => {
    btn.classList.toggle('dr-btn--loading', v);
    btn.setAttribute('aria-busy', String(v));
    if (iconEl) iconEl.style.display = v ? 'none' : '';
  };
  if (typeof props.loading === 'function') {
    effect(() => setLoading((props.loading as Signal<boolean>)()));
  } else {
    setLoading(props.loading ?? false);
  }

  if (props.onClick) {
    btn.addEventListener('click', props.onClick);
  }

  return btn;
}

// ── Styles ─────────────────────────────────────────────────────────────

const spinnerSVG = `<svg class="dr-btn__spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>`;

function injectButtonStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;

  const s = document.createElement('style');
  s.dataset['drComponent'] = 'button';
  s.textContent = `
.dr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  outline: none;
  cursor: pointer;
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-weight: 600;
  line-height: 1;
  border-radius: calc(var(--dr-border-radius, 8px) * var(--dr-adapt-radius, 1));
  transition:
    transform    calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1) * 0.4) cubic-bezier(.34,1.56,.64,1),
    box-shadow   calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1) * 0.5) ease,
    opacity      150ms ease,
    background   calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1)) ease;
  user-select: none;
  position: relative;
  white-space: nowrap;
}
.dr-btn:focus-visible {
  box-shadow: 0 0 0 3px var(--dr-color-primary, #3b82f6), 0 0 0 5px rgba(59,130,246,.2);
}
.dr-btn:active:not(:disabled) { transform: scale(0.94) !important; }

/* Sizes */
.dr-btn--xs  { padding: 4px  10px; font-size: .72rem; }
.dr-btn--sm  { padding: 6px  14px; font-size: .8rem;  }
.dr-btn--md  { padding: 9px  20px; font-size: .875rem;}
.dr-btn--lg  { padding: 12px 28px; font-size: 1rem;   }

/* Variants */
.dr-btn--primary {
  background: var(--dr-color-primary, #3b82f6);
  color: #fff;
  box-shadow: 0 0 0 0 transparent;
}
.dr-btn--primary:hover:not(:disabled) {
  filter: brightness(1.12);
  box-shadow: 0 4px 20px color-mix(in srgb, var(--dr-color-primary,#3b82f6) 50%, transparent);
  transform: translateY(-1px);
}
.dr-btn--secondary {
  background: var(--dr-color-secondary, #6366f1);
  color: #fff;
}
.dr-btn--secondary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.dr-btn--ghost {
  background: transparent;
  color: var(--dr-color-text, #e2e8f0);
  border: 1px solid var(--dr-color-border, rgba(255,255,255,.12));
}
.dr-btn--ghost:hover:not(:disabled) {
  background: rgba(255,255,255,.07);
  transform: translateY(-1px);
}
.dr-btn--danger {
  background: rgba(244,63,94,.12);
  color: #f43f5e;
  border: 1px solid rgba(244,63,94,.3);
}
.dr-btn--danger:hover:not(:disabled) {
  background: rgba(244,63,94,.22);
  transform: translateY(-1px);
}
.dr-btn--success {
  background: rgba(16,185,129,.12);
  color: #10b981;
  border: 1px solid rgba(16,185,129,.3);
}
.dr-btn--success:hover:not(:disabled) {
  background: rgba(16,185,129,.22);
  transform: translateY(-1px);
}

/* States */
.dr-btn--disabled, .dr-btn:disabled { opacity: .4; cursor: not-allowed; }
.dr-btn__spinner { display: none; }
.dr-btn--loading .dr-btn__spinner { display: inline-flex; }
.dr-btn--loading .dr-btn__label   { opacity: .6; }
.dr-btn__spin-icon {
  width: 1em; height: 1em;
  animation: dr-btn-spin .7s linear infinite;
}
@keyframes dr-btn-spin { to { transform: rotate(360deg); } }
.dr-btn__icon { display: inline-flex; align-items: center; width: 1em; height: 1em; }
.dr-btn__icon svg { width: 1em; height: 1em; }
`;
  document.head.appendChild(s);
}
