import { effect } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

export interface CheckboxProps {
  checked?:    Signal<boolean>;
  label?:      string;
  hint?:       string;
  disabled?:   boolean | Signal<boolean>;
  indeterminate?: boolean | Signal<boolean>;
  onChange?:   (checked: boolean) => void;
  class?:      string;
  id?:         string;
}

export interface SwitchProps {
  checked?:    Signal<boolean>;
  label?:      string;
  hint?:       string;
  disabled?:   boolean | Signal<boolean>;
  size?:       'sm' | 'md' | 'lg';
  onChange?:   (checked: boolean) => void;
  class?:      string;
  id?:         string;
}

export interface RadioGroupProps {
  options:     { value: string; label: string; hint?: string; disabled?: boolean }[];
  value?:      Signal<string>;
  name?:       string;
  label?:      string;
  orientation?:'horizontal' | 'vertical';
  onChange?:   (value: string) => void;
  class?:      string;
}

injectCheckboxStyles();

// ── Checkbox ───────────────────────────────────────────────────────────
export function Checkbox(props: CheckboxProps): HTMLLabelElement {
  const id      = props.id ?? `dr-cb-${Math.random().toString(36).slice(2, 8)}`;
  const _checked = props.checked ?? { peek: () => false, set: () => {} } as unknown as Signal<boolean>;

  const label = document.createElement('label');
  label.className = `dr-checkbox${props.class ? ` ${props.class}` : ''}`;
  label.htmlFor = id;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id   = id;
  input.className = 'dr-checkbox__input';

  const box = document.createElement('span');
  box.className = 'dr-checkbox__box';
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<svg class="dr-checkbox__check" viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,5 4.5,8.5 11,1"/></svg>
<svg class="dr-checkbox__dash" viewBox="0 0 12 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="1"/></svg>`;

  label.appendChild(input);
  label.appendChild(box);

  if (props.label || props.hint) {
    const textWrap = document.createElement('span');
    textWrap.className = 'dr-checkbox__text';
    if (props.label) {
      const lbl = document.createElement('span');
      lbl.className = 'dr-checkbox__label';
      lbl.textContent = props.label;
      textWrap.appendChild(lbl);
    }
    if (props.hint) {
      const hint = document.createElement('span');
      hint.className = 'dr-checkbox__hint';
      hint.textContent = props.hint;
      textWrap.appendChild(hint);
    }
    label.appendChild(textWrap);
  }

  // Sync checked state
  if (props.checked) {
    effect(() => { input.checked = (props.checked as Signal<boolean>)(); });
  }

  // Indeterminate
  if (props.indeterminate !== undefined) {
    if (typeof props.indeterminate === 'function') {
      effect(() => {
        input.indeterminate = (props.indeterminate as Signal<boolean>)();
        label.classList.toggle('dr-checkbox--indeterminate', input.indeterminate);
      });
    } else {
      input.indeterminate = props.indeterminate;
      if (props.indeterminate) label.classList.add('dr-checkbox--indeterminate');
    }
  }

  // Disabled
  if (typeof props.disabled === 'function') {
    effect(() => {
      const d = (props.disabled as Signal<boolean>)();
      input.disabled = d;
      label.classList.toggle('dr-checkbox--disabled', d);
    });
  } else if (props.disabled) {
    input.disabled = true;
    label.classList.add('dr-checkbox--disabled');
  }

  input.addEventListener('change', () => {
    props.checked?.set(input.checked);
    props.onChange?.(input.checked);
  });

  return label;
}

// ── Switch / Toggle ────────────────────────────────────────────────────
export function Switch(props: SwitchProps): HTMLLabelElement {
  const id      = props.id ?? `dr-sw-${Math.random().toString(36).slice(2, 8)}`;
  const size    = props.size ?? 'md';

  const label = document.createElement('label');
  label.className = `dr-switch dr-switch--${size}${props.class ? ` ${props.class}` : ''}`;
  label.htmlFor = id;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id   = id;
  input.className = 'dr-switch__input';
  input.setAttribute('role', 'switch');
  label.appendChild(input);

  const track = document.createElement('span');
  track.className = 'dr-switch__track';
  track.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('span');
  thumb.className = 'dr-switch__thumb';
  track.appendChild(thumb);
  label.appendChild(track);

  if (props.label || props.hint) {
    const textWrap = document.createElement('span');
    textWrap.className = 'dr-switch__text';
    if (props.label) {
      const lbl = document.createElement('span');
      lbl.className = 'dr-switch__label';
      lbl.textContent = props.label;
      textWrap.appendChild(lbl);
    }
    if (props.hint) {
      const hint = document.createElement('span');
      hint.className = 'dr-switch__hint';
      hint.textContent = props.hint;
      textWrap.appendChild(hint);
    }
    label.appendChild(textWrap);
  }

  if (props.checked) {
    effect(() => { input.checked = (props.checked as Signal<boolean>)(); });
  }

  if (typeof props.disabled === 'function') {
    effect(() => {
      const d = (props.disabled as Signal<boolean>)();
      input.disabled = d;
      label.classList.toggle('dr-switch--disabled', d);
    });
  } else if (props.disabled) {
    input.disabled = true;
    label.classList.add('dr-switch--disabled');
  }

  input.addEventListener('change', () => {
    props.checked?.set(input.checked);
    props.onChange?.(input.checked);
    input.setAttribute('aria-checked', String(input.checked));
  });

  return label;
}

// ── RadioGroup ─────────────────────────────────────────────────────────
export function RadioGroup(props: RadioGroupProps): HTMLFieldSetElement {
  const name   = props.name ?? `dr-rg-${Math.random().toString(36).slice(2, 8)}`;
  const orient = props.orientation ?? 'vertical';

  const fieldset = document.createElement('fieldset');
  fieldset.className = `dr-radio-group dr-radio-group--${orient}${props.class ? ` ${props.class}` : ''}`;

  if (props.label) {
    const legend = document.createElement('legend');
    legend.className = 'dr-radio-group__legend';
    legend.textContent = props.label;
    fieldset.appendChild(legend);
  }

  props.options.forEach((opt) => {
    const id    = `dr-radio-${name}-${opt.value}`;
    const wrap  = document.createElement('label');
    wrap.className = `dr-radio${opt.disabled ? ' dr-radio--disabled' : ''}`;
    wrap.htmlFor = id;

    const input = document.createElement('input');
    input.type  = 'radio';
    input.id    = id;
    input.name  = name;
    input.value = opt.value;
    input.className = 'dr-radio__input';
    if (opt.disabled) input.disabled = true;

    if (props.value) {
      effect(() => { input.checked = (props.value as Signal<string>)() === opt.value; });
    }

    input.addEventListener('change', () => {
      if (input.checked) {
        props.value?.set(opt.value);
        props.onChange?.(opt.value);
      }
    });

    const dot = document.createElement('span');
    dot.className = 'dr-radio__dot';
    dot.setAttribute('aria-hidden', 'true');
    wrap.appendChild(input);
    wrap.appendChild(dot);

    const textWrap = document.createElement('span');
    textWrap.className = 'dr-radio__text';
    const lbl = document.createElement('span');
    lbl.className = 'dr-radio__label';
    lbl.textContent = opt.label;
    textWrap.appendChild(lbl);
    if (opt.hint) {
      const hint = document.createElement('span');
      hint.className = 'dr-radio__hint';
      hint.textContent = opt.hint;
      textWrap.appendChild(hint);
    }
    wrap.appendChild(textWrap);
    fieldset.appendChild(wrap);
  });

  return fieldset;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectCheckboxStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'checkbox';
  s.textContent = `
/* ── Checkbox ─────────────────────────────────────────────────────── */
.dr-checkbox { display:inline-flex; align-items:flex-start; gap:10px; cursor:pointer; user-select:none; }
.dr-checkbox__input { position:absolute; opacity:0; width:0; height:0; pointer-events:none; }
.dr-checkbox__box {
  flex-shrink:0; display:flex; align-items:center; justify-content:center;
  width:18px; height:18px; border-radius:4px;
  border:2px solid var(--dr-color-border,rgba(255,255,255,.25));
  background:transparent;
  transition: border-color calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease,
              background    calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease,
              transform     calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.3) cubic-bezier(.34,1.56,.64,1);
  margin-top:1px;
}
.dr-checkbox__check, .dr-checkbox__dash { width:12px; height:auto; color:#fff; opacity:0; transition:opacity 120ms; }
.dr-checkbox__dash { display:none; }
.dr-checkbox__input:checked ~ .dr-checkbox__box {
  background: var(--dr-color-primary,#3b82f6);
  border-color: var(--dr-color-primary,#3b82f6);
  transform: scale(1.05);
}
.dr-checkbox__input:checked ~ .dr-checkbox__box .dr-checkbox__check { opacity:1; }
.dr-checkbox--indeterminate .dr-checkbox__box { background:var(--dr-color-primary,#3b82f6); border-color:var(--dr-color-primary,#3b82f6); }
.dr-checkbox--indeterminate .dr-checkbox__check { display:none; }
.dr-checkbox--indeterminate .dr-checkbox__dash { display:block; opacity:1; }
.dr-checkbox:hover:not(.dr-checkbox--disabled) .dr-checkbox__box { border-color:var(--dr-color-primary,#3b82f6); }
.dr-checkbox__input:focus-visible ~ .dr-checkbox__box { box-shadow:0 0 0 3px color-mix(in srgb,var(--dr-color-primary,#3b82f6) 30%,transparent); }
.dr-checkbox__text { display:flex; flex-direction:column; gap:2px; }
.dr-checkbox__label { font-family:var(--dr-font-family,system-ui); font-size:.875rem; color:var(--dr-color-text,#e2e8f0); }
.dr-checkbox__hint  { font-family:var(--dr-font-family,system-ui); font-size:.75rem; color:var(--dr-color-text-muted,#64748b); }
.dr-checkbox--disabled { opacity:.45; cursor:not-allowed; }

/* ── Switch ───────────────────────────────────────────────────────── */
.dr-switch { display:inline-flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
.dr-switch__input { position:absolute; opacity:0; width:0; height:0; pointer-events:none; }
.dr-switch__track {
  flex-shrink:0; position:relative; border-radius:9999px;
  background: rgba(255,255,255,.15);
  transition: background calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease;
}
.dr-switch--sm .dr-switch__track { width:32px; height:18px; }
.dr-switch--md .dr-switch__track { width:40px; height:22px; }
.dr-switch--lg .dr-switch__track { width:52px; height:28px; }
.dr-switch__thumb {
  position:absolute; top:50%; transform:translate(0,-50%);
  border-radius:50%; background:#fff;
  box-shadow:0 1px 4px rgba(0,0,0,.3);
  transition: left calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) cubic-bezier(.34,1.56,.64,1),
              background calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease;
}
.dr-switch--sm .dr-switch__thumb { width:13px; height:13px; left:2px; }
.dr-switch--md .dr-switch__thumb { width:16px; height:16px; left:3px; }
.dr-switch--lg .dr-switch__thumb { width:22px; height:22px; left:3px; }
.dr-switch__input:checked ~ .dr-switch__track { background:var(--dr-color-primary,#3b82f6); }
.dr-switch--sm  .dr-switch__input:checked ~ .dr-switch__track .dr-switch__thumb { left:calc(32px - 13px - 2px); }
.dr-switch--md  .dr-switch__input:checked ~ .dr-switch__track .dr-switch__thumb { left:calc(40px - 16px - 3px); }
.dr-switch--lg  .dr-switch__input:checked ~ .dr-switch__track .dr-switch__thumb { left:calc(52px - 22px - 3px); }
.dr-switch__input:focus-visible ~ .dr-switch__track { box-shadow:0 0 0 3px color-mix(in srgb,var(--dr-color-primary,#3b82f6) 30%,transparent); }
.dr-switch__text  { display:flex; flex-direction:column; gap:2px; }
.dr-switch__label { font-family:var(--dr-font-family,system-ui); font-size:.875rem; color:var(--dr-color-text,#e2e8f0); }
.dr-switch__hint  { font-family:var(--dr-font-family,system-ui); font-size:.75rem; color:var(--dr-color-text-muted,#64748b); }
.dr-switch--disabled { opacity:.45; cursor:not-allowed; }

/* ── Radio ────────────────────────────────────────────────────────── */
.dr-radio-group { border:none; padding:0; margin:0; display:flex; gap:10px; }
.dr-radio-group--vertical  { flex-direction:column; }
.dr-radio-group--horizontal { flex-direction:row; flex-wrap:wrap; }
.dr-radio-group__legend { font-family:var(--dr-font-family,system-ui); font-size:.8rem; font-weight:600; color:var(--dr-color-text,#e2e8f0); margin-bottom:8px; }
.dr-radio { display:inline-flex; align-items:flex-start; gap:10px; cursor:pointer; user-select:none; }
.dr-radio__input { position:absolute; opacity:0; width:0; height:0; pointer-events:none; }
.dr-radio__dot {
  flex-shrink:0; width:18px; height:18px; border-radius:50%;
  border:2px solid var(--dr-color-border,rgba(255,255,255,.25));
  position:relative; margin-top:1px;
  transition: border-color calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease;
}
.dr-radio__dot::after {
  content:''; position:absolute; inset:3px; border-radius:50%;
  background:var(--dr-color-primary,#3b82f6); opacity:0; transform:scale(0);
  transition: opacity 150ms, transform calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.4) cubic-bezier(.34,1.56,.64,1);
}
.dr-radio__input:checked ~ .dr-radio__dot { border-color:var(--dr-color-primary,#3b82f6); }
.dr-radio__input:checked ~ .dr-radio__dot::after { opacity:1; transform:scale(1); }
.dr-radio:hover:not(.dr-radio--disabled) .dr-radio__dot { border-color:var(--dr-color-primary,#3b82f6); }
.dr-radio__input:focus-visible ~ .dr-radio__dot { box-shadow:0 0 0 3px color-mix(in srgb,var(--dr-color-primary,#3b82f6) 30%,transparent); }
.dr-radio__text { display:flex; flex-direction:column; gap:2px; }
.dr-radio__label { font-family:var(--dr-font-family,system-ui); font-size:.875rem; color:var(--dr-color-text,#e2e8f0); }
.dr-radio__hint  { font-family:var(--dr-font-family,system-ui); font-size:.75rem; color:var(--dr-color-text-muted,#64748b); }
.dr-radio--disabled { opacity:.45; cursor:not-allowed; }
`;
  document.head.appendChild(s);
}
