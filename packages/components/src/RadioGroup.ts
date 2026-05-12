import type { Signal } from '@nexoraaidrishti/runtime';
import { signal } from '@nexoraaidrishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface RadioOption {
  value:     string;
  label:     string;
  disabled?: boolean;
}

export interface RadioGroupOptions {
  options:    RadioOption[];
  value?:     string;
  name?:      string;
  disabled?:  boolean;
  onChange?:  (value: string) => void;
  direction?: 'horizontal' | 'vertical';
}

export interface RadioGroupHandle {
  readonly value: Signal<string>;
  setValue(v: string): void;
  destroy(): void;
  mount(container: HTMLElement): void;
}

// ── Styles ─────────────────────────────────────────────────────────────

function injectRadioGroupStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-radiogroup-styles')) return;
  const style = document.createElement('style');
  style.id = 'dr-radiogroup-styles';
  style.textContent = `
.dr-radiogroup{border:none;padding:0;margin:0}
.dr-radiogroup__options{display:flex;flex-direction:column;gap:8px}
.dr-radiogroup__options--horizontal{flex-direction:row;gap:16px}
.dr-radiogroup__option{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#111827}
.dr-radiogroup__option--disabled{opacity:.5;cursor:not-allowed}
.dr-radiogroup__input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.dr-radiogroup__circle{display:inline-block;width:16px;height:16px;border-radius:50%;border:2px solid #d1d5db;background:#fff;flex-shrink:0;transition:border-color .15s,background .15s;position:relative}
.dr-radiogroup__input:checked + .dr-radiogroup__circle{border-color:#2563eb;background:#2563eb}
.dr-radiogroup__input:checked + .dr-radiogroup__circle::after{content:'';display:block;width:6px;height:6px;border-radius:50%;background:#fff;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}
.dr-radiogroup__input:focus + .dr-radiogroup__circle{box-shadow:0 0 0 3px rgba(37,99,235,.3)}
.dr-radiogroup__label{user-select:none}
`;
  document.head.appendChild(style);
}

// ── createRadioGroup ───────────────────────────────────────────────────

let _radioGroupCounter = 0;

export function createRadioGroup(opts: RadioGroupOptions): RadioGroupHandle {
  injectRadioGroupStyles();

  const groupName = opts.name ?? `dr-radiogroup-${++_radioGroupCounter}`;
  const value = signal<string>(opts.value ?? '');

  let container: HTMLElement | null = null;
  let fieldsetEl: HTMLElement | null = null;
  const inputEls: HTMLInputElement[] = [];
  const cleanups: Array<() => void> = [];

  function updateInputs(): void {
    const cur = value();
    for (const input of inputEls) {
      input.checked = input.value === cur;
    }
  }

  function setValue(v: string): void {
    value.set(v);
    updateInputs();
    opts.onChange?.(v);
  }

  function mount(el: HTMLElement): void {
    container = el;
    injectRadioGroupStyles();

    fieldsetEl = document.createElement('fieldset');
    fieldsetEl.className = 'dr-radiogroup';
    fieldsetEl.setAttribute('role', 'radiogroup');

    const optionsContainer = document.createElement('div');
    optionsContainer.className = `dr-radiogroup__options${opts.direction === 'horizontal' ? ' dr-radiogroup__options--horizontal' : ''}`;

    for (const opt of opts.options) {
      const isDisabled = opts.disabled || opt.disabled;

      const labelEl = document.createElement('label');
      labelEl.className = `dr-radiogroup__option${isDisabled ? ' dr-radiogroup__option--disabled' : ''}`;

      const inputEl = document.createElement('input');
      inputEl.type = 'radio';
      inputEl.className = 'dr-radiogroup__input';
      inputEl.name = groupName;
      inputEl.value = opt.value;
      inputEl.checked = opt.value === value();
      if (isDisabled) inputEl.disabled = true;

      const circleEl = document.createElement('span');
      circleEl.className = 'dr-radiogroup__circle';

      const spanEl = document.createElement('span');
      spanEl.className = 'dr-radiogroup__label';
      spanEl.textContent = opt.label;

      labelEl.appendChild(inputEl);
      labelEl.appendChild(circleEl);
      labelEl.appendChild(spanEl);
      optionsContainer.appendChild(labelEl);
      inputEls.push(inputEl);

      if (!isDisabled) {
        const handler = (): void => {
          value.set(opt.value);
          opts.onChange?.(opt.value);
        };
        inputEl.addEventListener('change', handler);
        cleanups.push(() => inputEl.removeEventListener('change', handler));
      }
    }

    fieldsetEl.appendChild(optionsContainer);
    el.appendChild(fieldsetEl);
  }

  function destroy(): void {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
    if (fieldsetEl && container) {
      container.removeChild(fieldsetEl);
    }
    fieldsetEl = null;
    container  = null;
    inputEls.length = 0;
  }

  return { value, setValue, destroy, mount };
}
