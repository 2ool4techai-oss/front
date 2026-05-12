import { signal, effect } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface SwitchOptions {
  checked?:  boolean;
  label?:    string;
  disabled?: boolean;
  size?:     'sm' | 'md' | 'lg';
  onChange?: (checked: boolean) => void;
}

export interface SwitchHandle {
  readonly checked: Signal<boolean>;
  toggle():  void;
  destroy(): void;
  mount(container: HTMLElement): void;
}

// ── Styles ─────────────────────────────────────────────────────────────

const SIZES = {
  sm: { w: 36, h: 20, thumb: 14, offset: 2 },
  md: { w: 44, h: 24, thumb: 18, offset: 3 },
  lg: { w: 52, h: 28, thumb: 22, offset: 3 },
};

let _stylesInjected = false;
function injectSwitchStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.dr-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
.dr-switch__track{position:relative;border-radius:999px;background:#d1d5db;transition:background .2s}
.dr-switch__track--checked{background:#2563eb}
.dr-switch__track--disabled{opacity:.5;cursor:not-allowed}
.dr-switch__thumb{position:absolute;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}
.dr-switch__label{font-size:14px}
`;
  document.head.appendChild(style);
}

// ── createSwitch ───────────────────────────────────────────────────────

export function createSwitch(opts?: SwitchOptions): SwitchHandle {
  injectSwitchStyles();

  const checked = signal(opts?.checked ?? false);
  const size    = opts?.size ?? 'md';
  const dim     = SIZES[size];

  let wrapEl:   HTMLElement | null = null;
  let trackEl:  HTMLElement | null = null;
  let thumbEl:  HTMLElement | null = null;
  let container: HTMLElement | null = null;
  const cleanups: Array<() => void> = [];

  function updateUI(): void {
    if (!trackEl || !thumbEl) return;
    const isChecked = checked();
    if (isChecked) {
      trackEl.classList.add('dr-switch__track--checked');
      trackEl.setAttribute('aria-checked', 'true');
      thumbEl.style.transform = `translateX(${dim.w - dim.thumb - dim.offset}px)`;
    } else {
      trackEl.classList.remove('dr-switch__track--checked');
      trackEl.setAttribute('aria-checked', 'false');
      thumbEl.style.transform = `translateX(0px)`;
    }
  }

  function toggle(): void {
    if (opts?.disabled) return;
    const next = !checked();
    checked.set(next);
    opts?.onChange?.(next);
    updateUI();
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  }

  function mount(el: HTMLElement): void {
    container = el;
    injectSwitchStyles();

    wrapEl = document.createElement('label');
    wrapEl.className = 'dr-switch';

    trackEl = document.createElement('div');
    trackEl.className = 'dr-switch__track' +
      (opts?.disabled ? ' dr-switch__track--disabled' : '');
    trackEl.setAttribute('role', 'switch');
    trackEl.setAttribute('aria-checked', String(checked()));
    trackEl.setAttribute('tabindex', opts?.disabled ? '-1' : '0');
    if (opts?.label) trackEl.setAttribute('aria-label', opts.label);
    trackEl.style.width  = `${dim.w}px`;
    trackEl.style.height = `${dim.h}px`;

    thumbEl = document.createElement('div');
    thumbEl.className = 'dr-switch__thumb';
    thumbEl.style.width  = `${dim.thumb}px`;
    thumbEl.style.height = `${dim.thumb}px`;
    thumbEl.style.top    = `${dim.offset}px`;
    thumbEl.style.left   = `${dim.offset}px`;
    thumbEl.style.transform = 'translateX(0px)';

    trackEl.appendChild(thumbEl);

    if (opts?.label) {
      const labelEl = document.createElement('span');
      labelEl.className = 'dr-switch__label';
      labelEl.textContent = opts.label;
      wrapEl.appendChild(trackEl);
      wrapEl.appendChild(labelEl);
    } else {
      wrapEl.appendChild(trackEl);
    }

    trackEl.addEventListener('click', toggle);
    trackEl.addEventListener('keydown', handleKeyDown);

    const unsub = checked.subscribe(() => updateUI());
    cleanups.push(unsub);

    el.appendChild(wrapEl);
    updateUI();
  }

  function destroy(): void {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
    if (wrapEl && container) {
      container.removeChild(wrapEl);
    }
    wrapEl    = null;
    container = null;
  }

  return { checked, toggle, destroy, mount };
}
