import { signal, effect } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'search' | 'url' | 'tel';

export interface InputProps {
  type?:        InputType;
  value?:       Signal<string>;
  placeholder?: string;
  label?:       string;
  hint?:        string;
  validate?:    (v: string) => string | null;  // return error string or null
  required?:    boolean;
  disabled?:    boolean | Signal<boolean>;
  readonly?:    boolean;
  maxLength?:   number;
  pattern?:     string;
  icon?:        string;  // SVG/HTML prepended inside input
  onInput?:     (v: string) => void;
  onChange?:    (v: string) => void;
  onSubmit?:    (v: string) => void;  // fired on Enter
  class?:       string;
  id?:          string;
}

let _stylesInjected = false;
injectInputStyles();

export function Input(props: InputProps): HTMLDivElement {
  const id    = props.id ?? `dr-input-${Math.random().toString(36).slice(2, 8)}`;
  const _err  = signal<string | null>(null);
  const _val  = props.value ?? signal('');

  // ── Wrapper ────────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.className = `dr-input-wrap${props.class ? ` ${props.class}` : ''}`;

  // ── Label ──────────────────────────────────────────────────────────
  if (props.label) {
    const label = document.createElement('label');
    label.className = 'dr-input__label';
    label.htmlFor = id;
    label.textContent = props.label;
    if (props.required) {
      const req = document.createElement('span');
      req.className = 'dr-input__required';
      req.textContent = ' *';
      req.setAttribute('aria-hidden', 'true');
      label.appendChild(req);
    }
    wrapper.appendChild(label);
  }

  // ── Input row (icon + input) ───────────────────────────────────────
  const row = document.createElement('div');
  row.className = 'dr-input__row';

  if (props.icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'dr-input__icon';
    iconEl.innerHTML = props.icon;
    iconEl.setAttribute('aria-hidden', 'true');
    row.appendChild(iconEl);
  }

  const input = document.createElement('input');
  input.type  = props.type ?? 'text';
  input.id    = id;
  input.className = `dr-input__field${props.icon ? ' dr-input__field--has-icon' : ''}`;
  if (props.placeholder) input.placeholder = props.placeholder;
  if (props.required)    input.required    = true;
  if (props.readonly)    input.readOnly    = true;
  if (props.maxLength)   input.maxLength   = props.maxLength;
  if (props.pattern)     input.pattern     = props.pattern;
  input.value = _val.peek();

  row.appendChild(input);
  wrapper.appendChild(row);

  // ── Hint ──────────────────────────────────────────────────────────
  const hintEl = document.createElement('p');
  hintEl.className = 'dr-input__hint';
  hintEl.id = `${id}-hint`;
  hintEl.textContent = props.hint ?? '';
  input.setAttribute('aria-describedby', hintEl.id);
  wrapper.appendChild(hintEl);

  // ── Error ─────────────────────────────────────────────────────────
  const errEl = document.createElement('p');
  errEl.className = 'dr-input-error';
  errEl.textContent = '';
  wrapper.appendChild(errEl);

  // ── Reactive value sync ────────────────────────────────────────────
  effect(() => {
    const v = _val();
    if (input.value !== v) input.value = v;
  });

  // Disabled
  if (typeof props.disabled === 'function') {
    effect(() => {
      const d = (props.disabled as Signal<boolean>)();
      input.disabled = d;
      wrapper.classList.toggle('dr-input-wrap--disabled', d);
    });
  } else if (props.disabled) {
    input.disabled = true;
    wrapper.classList.add('dr-input-wrap--disabled');
  }

  // ── Event handlers ─────────────────────────────────────────────────
  const validate = (v: string) => {
    const err = props.validate ? props.validate(v) : null;
    _err.set(err);
    input.setAttribute('aria-invalid', err ? 'true' : 'false');
    wrapper.classList.toggle('dr-input-wrap--error', !!err);
    hintEl.textContent = err ? '' : (props.hint ?? '');
    errEl.textContent = err ?? '';
  };

  input.addEventListener('blur', () => {
    validate(input.value);
  });

  input.addEventListener('input', () => {
    const v = input.value;
    _val.set(v);
    props.onInput?.(v);
    if (props.validate) validate(v);
  });

  input.addEventListener('change', () => {
    const v = input.value;
    validate(v);
    props.onChange?.(v);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && props.onSubmit) {
      validate(input.value);
      if (!_err.peek()) props.onSubmit(input.value);
    }
  });

  // Expose error signal on the element for external access
  (wrapper as WrappedInput)._drError = _err;
  (wrapper as WrappedInput)._drValue = _val;

  return wrapper;
}

export interface WrappedInput extends HTMLDivElement {
  _drError?: Signal<string | null>;
  _drValue?: Signal<string>;
}

// ── Styles ─────────────────────────────────────────────────────────────

function injectInputStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;

  const s = document.createElement('style');
  s.dataset['drComponent'] = 'input';
  s.textContent = `
.dr-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}
.dr-input__label {
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: .8rem;
  font-weight: 600;
  color: var(--dr-color-text, #e2e8f0);
  letter-spacing: .01em;
}
.dr-input__required { color: #f43f5e; }
.dr-input__row {
  position: relative;
  display: flex;
  align-items: center;
}
.dr-input__icon {
  position: absolute;
  left: 10px;
  display: flex;
  align-items: center;
  color: var(--dr-color-text-muted, #64748b);
  pointer-events: none;
}
.dr-input__icon svg { width: 16px; height: 16px; }
.dr-input__field {
  width: 100%;
  padding: 9px 12px;
  background: rgba(0,0,0,.28);
  border: 1px solid var(--dr-color-border, rgba(255,255,255,.1));
  border-radius: calc(var(--dr-border-radius, 8px) * var(--dr-adapt-radius, 1));
  color: var(--dr-color-text, #e2e8f0);
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: .875rem;
  outline: none;
  transition:
    border-color calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1) * 0.6) ease,
    box-shadow   calc(var(--dr-transition-speed, 300ms) * var(--dr-adapt-speed, 1) * 0.6) ease;
}
.dr-input__field::placeholder { color: var(--dr-color-text-muted, #64748b); opacity: .7; }
.dr-input__field:focus {
  border-color: var(--dr-color-primary, #3b82f6);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dr-color-primary, #3b82f6) 25%, transparent);
}
.dr-input__field--has-icon { padding-left: 34px; }
.dr-input__hint {
  font-family: var(--dr-font-family, system-ui, sans-serif);
  font-size: .75rem;
  color: var(--dr-color-text-muted, #64748b);
  min-height: 1em;
  margin: 0;
}
.dr-input__hint--error { color: #f43f5e !important; }
.dr-input-wrap--error .dr-input__field {
  border-color: rgba(244,63,94,.6);
  box-shadow: 0 0 0 3px rgba(244,63,94,.12);
}
.dr-input-wrap--disabled { opacity: .45; pointer-events: none; }
`;
  document.head.appendChild(s);
}
