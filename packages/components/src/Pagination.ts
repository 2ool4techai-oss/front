import { signal, computed, effect } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

export interface PaginationProps {
  total:      number | Signal<number>;  // total items
  pageSize?:  number;                   // items per page (default 10)
  page?:      Signal<number>;           // current page (1-based)
  siblings?:  number;                   // pages shown around current (default 1)
  showEnds?:  boolean;                  // show first/last buttons (default true)
  onChange?:  (page: number) => void;
  class?:     string;
}

export interface SliderProps {
  value?:     Signal<number>;
  min?:       number;
  max?:       number;
  step?:      number;
  label?:     string;
  showValue?: boolean;
  format?:    (v: number) => string;
  disabled?:  boolean | Signal<boolean>;
  onChange?:  (v: number) => void;
  class?:     string;
}

export interface BreadcrumbItem {
  label:   string;
  href?:   string;
  icon?:   string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items:     BreadcrumbItem[];
  separator?: string;   // HTML/text, default '/'
  class?:    string;
}

injectNavStyles();

// ── Pagination ─────────────────────────────────────────────────────────
export function Pagination(props: PaginationProps): HTMLElement {
  const pageSize = props.pageSize ?? 10;
  const siblings = props.siblings ?? 1;
  const showEnds = props.showEnds !== false;
  const _page    = props.page ?? signal(1);

  const _total   = typeof props.total === 'function' ? props.total : signal(props.total);
  const _pages   = computed(() => Math.max(1, Math.ceil(_total() / pageSize)));

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Pagination');
  nav.className = `dr-pagination${props.class ? ` ${props.class}` : ''}`;

  const render = () => {
    nav.innerHTML = '';
    const cur   = _page.peek();
    const pages = _pages();

    const go = (p: number) => {
      _page.set(p);
      props.onChange?.(p);
    };

    // Prev
    const prev = pageBtn('‹', cur <= 1, () => go(cur - 1), 'Previous page');
    nav.appendChild(prev);

    // Page numbers with ellipsis
    const range = buildRange(cur, pages, siblings, showEnds);
    let lastWasEllipsis = false;
    range.forEach(item => {
      if (item === '…') {
        if (!lastWasEllipsis) {
          const el = document.createElement('span');
          el.className = 'dr-pagination__ellipsis';
          el.textContent = '…';
          el.setAttribute('aria-hidden', 'true');
          nav.appendChild(el);
        }
        lastWasEllipsis = true;
      } else {
        lastWasEllipsis = false;
        const n = item as number;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dr-pagination__page${n === cur ? ' dr-pagination__page--active' : ''}`;
        btn.textContent = String(n);
        btn.setAttribute('aria-label', `Page ${n}`);
        if (n === cur) btn.setAttribute('aria-current', 'page');
        btn.addEventListener('click', () => go(n));
        nav.appendChild(btn);
      }
    });

    // Next
    const next = pageBtn('›', cur >= pages, () => go(cur + 1), 'Next page');
    nav.appendChild(next);
  };

  effect(() => { _page(); _pages(); render(); });

  return nav;
}

function pageBtn(label: string, disabled: boolean, onClick: () => void, ariaLabel: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `dr-pagination__nav${disabled ? ' dr-pagination__nav--disabled' : ''}`;
  btn.innerHTML = label;
  btn.disabled = disabled;
  btn.setAttribute('aria-label', ariaLabel);
  btn.addEventListener('click', onClick);
  return btn;
}

function buildRange(cur: number, pages: number, siblings: number, showEnds: boolean): (number | '…')[] {
  const lo = Math.max(showEnds ? 2 : 1, cur - siblings);
  const hi = Math.min(showEnds ? pages - 1 : pages, cur + siblings);
  const out: (number | '…')[] = [];

  if (showEnds) out.push(1);
  if (lo > (showEnds ? 2 : 1)) out.push('…');
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < (showEnds ? pages - 1 : pages)) out.push('…');
  if (showEnds && pages > 1) out.push(pages);
  return out;
}

// ── Slider ─────────────────────────────────────────────────────────────
export function Slider(props: SliderProps): HTMLDivElement {
  const min  = props.min  ?? 0;
  const max  = props.max  ?? 100;
  const step = props.step ?? 1;
  const fmt  = props.format ?? ((v: number) => String(v));
  const _val = props.value ?? signal(min);

  const wrap = document.createElement('div');
  wrap.className = `dr-slider-wrap${props.class ? ` ${props.class}` : ''}`;

  if (props.label || props.showValue) {
    const header = document.createElement('div');
    header.className = 'dr-slider-header';
    if (props.label) {
      const lbl = document.createElement('label');
      lbl.className = 'dr-slider-label';
      lbl.textContent = props.label;
      header.appendChild(lbl);
    }
    if (props.showValue) {
      const valEl = document.createElement('span');
      valEl.className = 'dr-slider-current';
      effect(() => { valEl.textContent = fmt(_val()); });
      header.appendChild(valEl);
    }
    wrap.appendChild(header);
  }

  const row = document.createElement('div');
  row.className = 'dr-slider-row';

  const track = document.createElement('div');
  track.className = 'dr-slider-track';
  const fill = document.createElement('div');
  fill.className = 'dr-slider-fill';
  track.appendChild(fill);
  row.appendChild(track);

  const input = document.createElement('input');
  input.type  = 'range';
  input.min   = String(min);
  input.max   = String(max);
  input.step  = String(step);
  input.className = 'dr-slider-input';
  row.appendChild(input);
  wrap.appendChild(row);

  const update = (v: number) => {
    input.value = String(v);
    const pct = ((v - min) / (max - min)) * 100;
    fill.style.width = `${pct}%`;
    input.style.setProperty('--thumb-pct', `${pct}%`);
  };

  effect(() => update(_val()));

  if (typeof props.disabled === 'function') {
    effect(() => {
      const d = (props.disabled as Signal<boolean>)();
      input.disabled = d;
      wrap.classList.toggle('dr-slider-wrap--disabled', d);
    });
  } else if (props.disabled) {
    input.disabled = true;
    wrap.classList.add('dr-slider-wrap--disabled');
  }

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    _val.set(v);
    props.onChange?.(v);
  });

  return wrap;
}

// ── Breadcrumb ─────────────────────────────────────────────────────────
export function Breadcrumb(props: BreadcrumbProps): HTMLElement {
  const sep = props.separator ?? '/';

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');
  nav.className = `dr-breadcrumb${props.class ? ` ${props.class}` : ''}`;

  const ol = document.createElement('ol');
  ol.className = 'dr-breadcrumb__list';

  props.items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'dr-breadcrumb__item';

    if (i > 0) {
      const s = document.createElement('span');
      s.className = 'dr-breadcrumb__sep';
      s.innerHTML = sep;
      s.setAttribute('aria-hidden', 'true');
      li.appendChild(s);
    }

    const isLast = i === props.items.length - 1;
    let inner: HTMLElement;

    if (isLast) {
      inner = document.createElement('span');
      inner.setAttribute('aria-current', 'page');
    } else if (item.href) {
      inner = document.createElement('a');
      (inner as HTMLAnchorElement).href = item.href;
    } else {
      inner = document.createElement('button');
      (inner as HTMLButtonElement).type = 'button';
      if (item.onClick) inner.addEventListener('click', item.onClick);
    }

    inner.className = `dr-breadcrumb__link${isLast ? ' dr-breadcrumb__link--current' : ''}`;

    if (item.icon) {
      const ic = document.createElement('span');
      ic.className = 'dr-breadcrumb__icon';
      ic.innerHTML = item.icon;
      inner.appendChild(ic);
    }
    inner.appendChild(document.createTextNode(item.label));
    li.appendChild(inner);
    ol.appendChild(li);
  });

  nav.appendChild(ol);
  return nav;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectNavStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'nav';
  s.textContent = `
/* ── Pagination ──────────────────────────────────────────────────── */
.dr-pagination { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.dr-pagination__page, .dr-pagination__nav {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:34px; height:34px; padding:0 6px;
  border:1px solid var(--dr-color-border,rgba(255,255,255,.1));
  border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1)*.8);
  background:transparent; color:var(--dr-color-text-muted,#64748b);
  font-family:var(--dr-font-family,system-ui); font-size:.85rem; font-weight:500;
  cursor:pointer;
  transition: background calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.4) ease,
              color     calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.4) ease,
              transform 120ms cubic-bezier(.34,1.56,.64,1);
}
.dr-pagination__page:hover:not(.dr-pagination__page--active) { background:rgba(255,255,255,.07); color:var(--dr-color-text,#e2e8f0); }
.dr-pagination__page--active { background:var(--dr-color-primary,#3b82f6); border-color:var(--dr-color-primary,#3b82f6); color:#fff; font-weight:700; }
.dr-pagination__nav:hover:not(:disabled) { background:rgba(255,255,255,.07); color:var(--dr-color-text,#e2e8f0); }
.dr-pagination__nav--disabled, .dr-pagination__nav:disabled { opacity:.3; cursor:not-allowed; }
.dr-pagination__ellipsis { display:inline-flex; align-items:center; justify-content:center; min-width:34px; height:34px; color:var(--dr-color-text-muted,#64748b); font-size:.85rem; }

/* ── Slider ───────────────────────────────────────────────────────── */
.dr-slider-wrap { display:flex; flex-direction:column; gap:6px; width:100%; }
.dr-slider-header { display:flex; justify-content:space-between; }
.dr-slider-label { font-family:var(--dr-font-family,system-ui); font-size:.8rem; font-weight:600; color:var(--dr-color-text,#e2e8f0); }
.dr-slider-current { font-family:var(--dr-font-family,system-ui); font-size:.8rem; color:var(--dr-color-primary,#3b82f6); font-weight:600; }
.dr-slider-row { position:relative; height:20px; display:flex; align-items:center; }
.dr-slider-track { position:absolute; left:0; right:0; height:4px; background:rgba(255,255,255,.1); border-radius:9999px; pointer-events:none; overflow:hidden; }
.dr-slider-fill { height:100%; background:var(--dr-color-primary,#3b82f6); border-radius:9999px; transition:width calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.4) ease; }
.dr-slider-input {
  position:absolute; left:0; right:0; width:100%; margin:0;
  -webkit-appearance:none; appearance:none; background:transparent; cursor:pointer; height:20px;
}
.dr-slider-input::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 6px rgba(0,0,0,.4); transition:transform calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.3) cubic-bezier(.34,1.56,.64,1); }
.dr-slider-input:hover::-webkit-slider-thumb { transform:scale(1.15); }
.dr-slider-input:focus-visible { outline:none; }
.dr-slider-input:focus-visible::-webkit-slider-thumb { box-shadow:0 0 0 3px color-mix(in srgb,var(--dr-color-primary,#3b82f6) 30%,transparent); }
.dr-slider-wrap--disabled { opacity:.45; pointer-events:none; }

/* ── Breadcrumb ───────────────────────────────────────────────────── */
.dr-breadcrumb__list { display:flex; align-items:center; flex-wrap:wrap; gap:4px; list-style:none; margin:0; padding:0; }
.dr-breadcrumb__item { display:inline-flex; align-items:center; gap:4px; }
.dr-breadcrumb__sep { color:var(--dr-color-text-muted,#64748b); font-size:.85rem; }
.dr-breadcrumb__link { display:inline-flex; align-items:center; gap:4px; background:transparent; border:none; padding:0; font-family:var(--dr-font-family,system-ui); font-size:.85rem; color:var(--dr-color-text-muted,#64748b); text-decoration:none; cursor:pointer; transition:color calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.4) ease; }
.dr-breadcrumb__link:hover:not(.dr-breadcrumb__link--current) { color:var(--dr-color-text,#e2e8f0); }
.dr-breadcrumb__link--current { color:var(--dr-color-text,#e2e8f0); cursor:default; font-weight:600; }
.dr-breadcrumb__icon { display:flex; width:15px; height:15px; }
.dr-breadcrumb__icon svg { width:15px; height:15px; }
`;
  document.head.appendChild(s);
}
