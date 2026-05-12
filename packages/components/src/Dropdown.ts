import { signal, effect } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

export interface DropdownOption {
  value:     string;
  label:     string;
  disabled?: boolean;
  icon?:     string;
  group?:    string;
}

export interface DropdownProps {
  options:       DropdownOption[] | Signal<DropdownOption[]>;
  value?:        Signal<string>;
  placeholder?:  string;
  label?:        string;
  hint?:         string;
  disabled?:     boolean | Signal<boolean>;
  searchable?:   boolean;
  multiple?:     boolean;
  maxHeight?:    number;
  onChange?:     (value: string, option: DropdownOption) => void;
  class?:        string;
  id?:           string;
}

injectDropdownStyles();

export function Dropdown(props: DropdownProps): HTMLDivElement {
  const id       = props.id ?? `dr-dd-${Math.random().toString(36).slice(2, 8)}`;
  const _value   = props.value ?? signal('');
  const _open    = signal(false);
  const _search  = signal('');
  const _focused = signal(-1);

  // ── Root ────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = `dr-dd${props.class ? ` ${props.class}` : ''}`;
  root.setAttribute('data-dr-dropdown', '');

  // ── Label ───────────────────────────────────────────────────────────
  if (props.label) {
    const lbl = document.createElement('label');
    lbl.className = 'dr-dd__label';
    lbl.htmlFor   = id;
    lbl.textContent = props.label;
    root.appendChild(lbl);
  }

  // ── Trigger ─────────────────────────────────────────────────────────
  const trigger = document.createElement('button');
  trigger.type      = 'button';
  trigger.id        = id;
  trigger.className = 'dr-dd__trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const triggerText = document.createElement('span');
  triggerText.className = 'dr-dd__trigger-text';

  const chevron = document.createElement('span');
  chevron.className = 'dr-dd__chevron';
  chevron.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;

  trigger.appendChild(triggerText);
  trigger.appendChild(chevron);
  root.appendChild(trigger);

  // ── Panel ───────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.className = 'dr-dd__panel';
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('aria-labelledby', id);
  if (props.maxHeight) panel.style.maxHeight = `${props.maxHeight}px`;
  root.appendChild(panel);

  // ── Search ──────────────────────────────────────────────────────────
  let searchInput: HTMLInputElement | null = null;
  if (props.searchable) {
    const searchWrap = document.createElement('div');
    searchWrap.className = 'dr-dd__search-wrap';
    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dr-dd__search';
    searchInput.placeholder = 'Search…';
    searchInput.setAttribute('aria-label', 'Search options');
    searchInput.addEventListener('input', () => _search.set(searchInput!.value));
    searchWrap.appendChild(searchInput);
    panel.appendChild(searchWrap);
  }

  // ── Options list ─────────────────────────────────────────────────────
  const listEl = document.createElement('div');
  listEl.className = 'dr-dd__list';
  panel.appendChild(listEl);

  // ── Hint ─────────────────────────────────────────────────────────────
  if (props.hint) {
    const hint = document.createElement('p');
    hint.className = 'dr-dd__hint';
    hint.textContent = props.hint;
    root.appendChild(hint);
  }

  // ── Reactivity ──────────────────────────────────────────────────────
  const getOptions = (): DropdownOption[] =>
    typeof props.options === 'function' ? props.options() : props.options;

  // Render trigger text
  effect(() => {
    const val  = _value();
    const opts = getOptions();
    const found = opts.find(o => o.value === val);
    triggerText.textContent = found ? found.label : (props.placeholder ?? 'Select…');
    triggerText.classList.toggle('dr-dd__trigger-text--placeholder', !found);
  });

  // Render option list
  effect(() => {
    const opts  = getOptions();
    const query = _search().toLowerCase();
    const cur   = _value();

    listEl.innerHTML = '';
    const filtered = query ? opts.filter(o => o.label.toLowerCase().includes(query)) : opts;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dr-dd__empty';
      empty.textContent = 'No options';
      listEl.appendChild(empty);
      return;
    }

    let lastGroup = '';
    filtered.forEach((opt, i) => {
      if (opt.group && opt.group !== lastGroup) {
        lastGroup = opt.group;
        const grp = document.createElement('div');
        grp.className = 'dr-dd__group';
        grp.textContent = opt.group;
        listEl.appendChild(grp);
      }

      const item = document.createElement('div');
      item.className = `dr-dd__option${opt.value === cur ? ' dr-dd__option--selected' : ''}${opt.disabled ? ' dr-dd__option--disabled' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(opt.value === cur));
      item.dataset['idx'] = String(i);

      if (opt.icon) {
        const ic = document.createElement('span');
        ic.className = 'dr-dd__option-icon';
        ic.innerHTML = opt.icon;
        item.appendChild(ic);
      }
      const lbl = document.createElement('span');
      lbl.textContent = opt.label;
      item.appendChild(lbl);

      if (opt.value === cur) {
        const check = document.createElement('span');
        check.className = 'dr-dd__check';
        check.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
        item.appendChild(check);
      }

      if (!opt.disabled) {
        item.addEventListener('click', () => select(opt));
        item.addEventListener('mouseenter', () => _focused.set(i));
      }
      listEl.appendChild(item);
    });
  });

  // Open/close state
  effect(() => {
    const open = _open();
    root.classList.toggle('dr-dd--open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open && searchInput) {
      setTimeout(() => searchInput!.focus(), 50);
    }
  });

  // Disabled
  if (typeof props.disabled === 'function') {
    effect(() => {
      const d = (props.disabled as Signal<boolean>)();
      trigger.disabled = d;
      root.classList.toggle('dr-dd--disabled', d);
    });
  } else if (props.disabled) {
    trigger.disabled = true;
    root.classList.add('dr-dd--disabled');
  }

  // ── Event handlers ──────────────────────────────────────────────────
  function select(opt: DropdownOption): void {
    _value.set(opt.value);
    _open.set(false);
    _search.set('');
    props.onChange?.(opt.value, opt);
  }

  trigger.addEventListener('click', () => _open.set(!_open.peek()));

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target as Node)) _open.set(false);
  });

  // Keyboard nav
  trigger.addEventListener('keydown', (e) => {
    const opts = getOptions();
    if (e.key === 'ArrowDown') { e.preventDefault(); _open.set(true); }
    if (e.key === 'Escape')    { _open.set(false); }
    if (e.key === 'Enter' && _open.peek()) {
      const idx = _focused.peek();
      if (idx >= 0 && opts[idx]) select(opts[idx]!);
    }
  });

  return root;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectDropdownStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'dropdown';
  s.textContent = `
.dr-dd { position: relative; display: flex; flex-direction: column; gap: 5px; width: 100%; }
.dr-dd__label { font-family: var(--dr-font-family,system-ui); font-size:.8rem; font-weight:600; color:var(--dr-color-text,#e2e8f0); }
.dr-dd__trigger {
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  width:100%; padding:9px 12px;
  background:rgba(0,0,0,.28); border:1px solid var(--dr-color-border,rgba(255,255,255,.1));
  border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1));
  color:var(--dr-color-text,#e2e8f0); font-family:var(--dr-font-family,system-ui); font-size:.875rem;
  cursor:pointer; text-align:left;
  transition: border-color calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.6) ease,
              box-shadow   calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.6) ease;
}
.dr-dd__trigger:focus-visible { border-color:var(--dr-color-primary,#3b82f6); box-shadow:0 0 0 3px color-mix(in srgb,var(--dr-color-primary,#3b82f6) 25%,transparent); }
.dr-dd--open .dr-dd__trigger { border-color:var(--dr-color-primary,#3b82f6); }
.dr-dd__trigger-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dr-dd__trigger-text--placeholder { color:var(--dr-color-text-muted,#64748b); }
.dr-dd__chevron { display:flex; flex-shrink:0; color:var(--dr-color-text-muted,#64748b); transition:transform calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease; }
.dr-dd__chevron svg { width:16px; height:16px; }
.dr-dd--open .dr-dd__chevron { transform:rotate(180deg); }
.dr-dd__panel {
  position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:200;
  background:var(--dr-color-surface-high,#10101e); border:1px solid var(--dr-color-border,rgba(255,255,255,.1));
  border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1));
  box-shadow:0 8px 32px rgba(0,0,0,.5); overflow:hidden;
  max-height:260px; display:none; flex-direction:column;
}
.dr-dd--open .dr-dd__panel { display:flex; }
.dr-dd__search-wrap { padding:8px; border-bottom:1px solid var(--dr-color-border,rgba(255,255,255,.08)); }
.dr-dd__search { width:100%; padding:6px 10px; background:rgba(0,0,0,.3); border:1px solid var(--dr-color-border,rgba(255,255,255,.1)); border-radius:6px; color:var(--dr-color-text,#e2e8f0); font-family:var(--dr-font-family,system-ui); font-size:.8rem; outline:none; }
.dr-dd__list { overflow-y:auto; flex:1; padding:4px; }
.dr-dd__group { padding:6px 10px 2px; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--dr-color-text-muted,#64748b); }
.dr-dd__option { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:6px; font-family:var(--dr-font-family,system-ui); font-size:.875rem; cursor:pointer; color:var(--dr-color-text,#e2e8f0); transition:background 120ms; }
.dr-dd__option:hover { background:rgba(255,255,255,.07); }
.dr-dd__option--selected { color:var(--dr-color-primary,#3b82f6); font-weight:600; }
.dr-dd__option--selected:hover { background:color-mix(in srgb,var(--dr-color-primary,#3b82f6) 12%,transparent); }
.dr-dd__option--disabled { opacity:.4; cursor:not-allowed; }
.dr-dd__option-icon { display:flex; width:16px; height:16px; flex-shrink:0; }
.dr-dd__check { display:flex; margin-left:auto; flex-shrink:0; }
.dr-dd__check svg { width:16px; height:16px; }
.dr-dd__empty { padding:20px; text-align:center; font-size:.85rem; color:var(--dr-color-text-muted,#64748b); font-family:var(--dr-font-family,system-ui); }
.dr-dd__hint { font-size:.75rem; color:var(--dr-color-text-muted,#64748b); margin:0; font-family:var(--dr-font-family,system-ui); }
.dr-dd--disabled { opacity:.45; pointer-events:none; }
`;
  document.head.appendChild(s);
}
