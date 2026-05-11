import { signal, effect } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface SelectOption {
  value:     string;
  label:     string;
  disabled?: boolean;
  group?:    string;
}

export interface SelectOptions {
  options:      SelectOption[];
  value?:       string;
  placeholder?: string;
  multiple?:    boolean;
  searchable?:  boolean;
  disabled?:    boolean;
  onChange?:    (value: string | string[]) => void;
  size?:        'sm' | 'md' | 'lg';
}

export interface SelectHandle {
  readonly value: Signal<string | string[]>;
  open():    void;
  close():   void;
  reset():   void;
  destroy(): void;
  mount(container: HTMLElement): void;
}

// ── Styles ─────────────────────────────────────────────────────────────

let _stylesInjected = false;
function injectSelectStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.dr-select{position:relative;display:inline-block;min-width:160px}
.dr-select__trigger{display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer;border:1px solid #d1d5db;border-radius:6px;background:#fff;padding:6px 10px;font-size:14px;gap:6px}
.dr-select--sm .dr-select__trigger{padding:4px 8px;font-size:12px}
.dr-select--lg .dr-select__trigger{padding:8px 14px;font-size:16px}
.dr-select__trigger:disabled{opacity:.5;cursor:not-allowed}
.dr-select__dropdown{position:absolute;top:100%;left:0;right:0;z-index:1000;background:#fff;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.1);margin-top:2px;overflow:hidden;display:none}
.dr-select__dropdown--open{display:block}
.dr-select__search{width:100%;border:none;border-bottom:1px solid #e5e7eb;padding:6px 10px;font-size:14px;outline:none}
.dr-select__list{max-height:240px;overflow-y:auto;padding:4px 0}
.dr-select__option{padding:6px 10px;cursor:pointer;font-size:14px}
.dr-select__option:hover{background:#f3f4f6}
.dr-select__option--selected{background:#eff6ff;color:#2563eb}
.dr-select__option--disabled{opacity:.5;cursor:not-allowed;pointer-events:none}
.dr-select__option[aria-selected="true"]{background:#eff6ff;color:#2563eb}
`;
  document.head.appendChild(style);
}

// ── createSelect ───────────────────────────────────────────────────────

export function createSelect(opts: SelectOptions): SelectHandle {
  injectSelectStyles();

  const multiple = opts.multiple ?? false;
  const initialValue: string | string[] = multiple
    ? (opts.value ? [opts.value] : [])
    : (opts.value ?? '');

  const value      = signal<string | string[]>(initialValue);
  const isOpen     = signal(false);
  const searchQuery = signal('');

  let container: HTMLElement | null = null;
  let wrapEl:    HTMLElement | null = null;
  let dropdownEl: HTMLElement | null = null;
  let triggerEl:  HTMLButtonElement | null = null;
  let listEl:     HTMLElement | null = null;
  let searchEl:   HTMLInputElement | null = null;
  let focusedIdx  = -1;
  const cleanups: Array<() => void> = [];

  function getFilteredOptions(): SelectOption[] {
    const q = searchQuery().toLowerCase();
    if (!q) return opts.options;
    return opts.options.filter((o) =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }

  function isSelected(optValue: string): boolean {
    const v = value();
    if (Array.isArray(v)) return v.includes(optValue);
    return v === optValue;
  }

  function selectOption(optValue: string): void {
    if (multiple) {
      const cur = value() as string[];
      const next = cur.includes(optValue)
        ? cur.filter((x) => x !== optValue)
        : [...cur, optValue];
      value.set(next);
      opts.onChange?.(next);
    } else {
      value.set(optValue);
      opts.onChange?.(optValue);
      close();
    }
  }

  function renderList(): void {
    if (!listEl) return;
    listEl.innerHTML = '';
    const filtered = getFilteredOptions();
    filtered.forEach((opt, idx) => {
      const li = document.createElement('div');
      li.className = 'dr-select__option' +
        (isSelected(opt.value) ? ' dr-select__option--selected' : '') +
        (opt.disabled ? ' dr-select__option--disabled' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(isSelected(opt.value)));
      li.textContent = opt.label;
      if (!opt.disabled) {
        li.addEventListener('click', () => selectOption(opt.value));
      }
      if (idx === focusedIdx) {
        li.style.outline = '2px solid #2563eb';
      }
      listEl!.appendChild(li);
    });
  }

  function updateTriggerLabel(): void {
    if (!triggerEl) return;
    const v = value();
    if (Array.isArray(v) && v.length === 0) {
      triggerEl.textContent = opts.placeholder ?? 'Select...';
    } else if (Array.isArray(v)) {
      const labels = v.map(
        (val) => opts.options.find((o) => o.value === val)?.label ?? val,
      );
      triggerEl.textContent = labels.join(', ');
    } else if (!v) {
      triggerEl.textContent = opts.placeholder ?? 'Select...';
    } else {
      const found = opts.options.find((o) => o.value === v);
      triggerEl.textContent = found ? found.label : v;
    }
  }

  function open(): void {
    if (opts.disabled) return;
    isOpen.set(true);
    if (dropdownEl) dropdownEl.classList.add('dr-select__dropdown--open');
    renderList();
    searchEl?.focus();
    triggerEl?.setAttribute('aria-expanded', 'true');
  }

  function close(): void {
    isOpen.set(false);
    if (dropdownEl) dropdownEl.classList.remove('dr-select__dropdown--open');
    focusedIdx = -1;
    searchQuery.set('');
    if (searchEl) searchEl.value = '';
    triggerEl?.setAttribute('aria-expanded', 'false');
    triggerEl?.focus();
  }

  function reset(): void {
    value.set(multiple ? [] : '');
    opts.onChange?.(multiple ? [] : '');
    updateTriggerLabel();
    renderList();
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (!isOpen()) return;
    const filtered = getFilteredOptions();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIdx = Math.min(focusedIdx + 1, filtered.length - 1);
      renderList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIdx = Math.max(focusedIdx - 1, 0);
      renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[focusedIdx];
      if (opt && !opt.disabled) selectOption(opt.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function handleDocClick(e: MouseEvent): void {
    if (wrapEl && !wrapEl.contains(e.target as Node)) {
      close();
    }
  }

  function mount(el: HTMLElement): void {
    container = el;
    injectSelectStyles();

    wrapEl = document.createElement('div');
    wrapEl.className = `dr-select dr-select--${opts.size ?? 'md'}`;
    wrapEl.setAttribute('role', 'combobox');
    wrapEl.setAttribute('aria-haspopup', 'listbox');
    wrapEl.setAttribute('aria-expanded', 'false');

    triggerEl = document.createElement('button');
    triggerEl.type = 'button';
    triggerEl.className = 'dr-select__trigger';
    triggerEl.setAttribute('aria-haspopup', 'listbox');
    triggerEl.setAttribute('aria-expanded', 'false');
    if (opts.disabled) triggerEl.disabled = true;
    triggerEl.addEventListener('click', () => {
      if (isOpen()) close(); else open();
    });

    dropdownEl = document.createElement('div');
    dropdownEl.className = 'dr-select__dropdown';
    dropdownEl.setAttribute('role', 'listbox');

    if (opts.searchable) {
      searchEl = document.createElement('input');
      searchEl.type = 'text';
      searchEl.className = 'dr-select__search';
      searchEl.placeholder = 'Search...';
      searchEl.addEventListener('input', () => {
        searchQuery.set(searchEl!.value);
        focusedIdx = -1;
        renderList();
      });
      dropdownEl.appendChild(searchEl);
    }

    listEl = document.createElement('div');
    listEl.className = 'dr-select__list';
    dropdownEl.appendChild(listEl);

    wrapEl.appendChild(triggerEl);
    wrapEl.appendChild(dropdownEl);
    el.appendChild(wrapEl);

    wrapEl.addEventListener('keydown', handleKeyDown);

    const unsub = value.subscribe(() => {
      updateTriggerLabel();
      if (isOpen()) renderList();
    });
    cleanups.push(unsub);

    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleDocClick);
      cleanups.push(() => document.removeEventListener('click', handleDocClick));
    }

    updateTriggerLabel();
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

  return { value, open, close, reset, destroy, mount };
}
