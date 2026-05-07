import { signal, computed, effect } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface DatePickerProps {
  value?:        Signal<Date | null>;
  min?:          Date;
  max?:          Date;
  placeholder?:  string;
  format?:       (d: Date) => string;
  disabled?:     Signal<boolean> | boolean;
  clearable?:    boolean;
  showTime?:     boolean;
  locale?:       string;
  onChange?:     (d: Date | null) => void;
  class?:        string;
}

export interface TimePickerProps {
  value?:    Signal<string | null>; // 'HH:mm'
  min?:      string;
  max?:      string;
  step?:     number;               // minutes, default 30
  disabled?: Signal<boolean> | boolean;
  onChange?: (t: string | null) => void;
  class?:    string;
}

// ── Helpers ────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function defaultFormat(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Styles ─────────────────────────────────────────────────────────────
const injectStyles = (() => {
  let done = false;
  return () => {
    if (done || typeof document === 'undefined') return;
    done = true;
    const s = document.createElement('style');
    s.textContent = `
.dr-dp-wrap{position:relative;display:inline-block;font-family:inherit;font-size:14px;}
.dr-dp-input-row{display:flex;align-items:center;border:1px solid var(--dr-border-color,#e2e8f0);border-radius:var(--dr-border-radius,8px);background:var(--dr-surface,#fff);padding:0 8px;cursor:pointer;transition:border .2s;}
.dr-dp-input-row:focus-within{border-color:var(--dr-primary,#6366f1);box-shadow:0 0 0 3px color-mix(in srgb,var(--dr-primary,#6366f1) 15%,transparent);}
.dr-dp-input{border:none;outline:none;background:transparent;padding:8px 4px;font-size:14px;cursor:pointer;width:120px;color:inherit;}
.dr-dp-icon{color:var(--dr-text-muted,#94a3b8);flex-shrink:0;}
.dr-dp-clear{color:var(--dr-text-muted,#94a3b8);cursor:pointer;padding:0 4px;border:none;background:none;font-size:16px;line-height:1;}
.dr-dp-clear:hover{color:var(--dr-danger,#f87171);}
.dr-calendar{position:absolute;top:calc(100% + 6px);left:0;z-index:1000;background:var(--dr-surface,#fff);border:1px solid var(--dr-border-color,#e2e8f0);border-radius:var(--dr-border-radius,12px);box-shadow:0 8px 32px rgba(0,0,0,.12);padding:12px;min-width:280px;animation:dr-dp-in .15s ease;}
@keyframes dr-dp-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.dr-cal-nav{display:flex;align-items:center;gap:4px;margin-bottom:12px;}
.dr-cal-nav-btn{background:none;border:1px solid var(--dr-border-color,#e2e8f0);border-radius:var(--dr-border-radius,6px);width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:inherit;font-size:14px;transition:all .15s;}
.dr-cal-nav-btn:hover{background:var(--dr-surface-high,#f1f5f9);border-color:var(--dr-primary,#6366f1);}
.dr-cal-title{flex:1;text-align:center;font-weight:600;font-size:14px;}
.dr-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
.dr-cal-day-name{text-align:center;font-size:11px;font-weight:600;color:var(--dr-text-muted,#94a3b8);padding:4px 0;text-transform:uppercase;}
.dr-cal-day{text-align:center;padding:6px 0;cursor:pointer;border-radius:var(--dr-border-radius,6px);font-size:13px;border:none;background:none;color:inherit;transition:background .1s,color .1s;}
.dr-cal-day:hover:not(:disabled){background:var(--dr-surface-high,#f1f5f9);}
.dr-cal-day.today{font-weight:700;color:var(--dr-primary,#6366f1);}
.dr-cal-day.selected{background:var(--dr-primary,#6366f1);color:#fff;}
.dr-cal-day.selected:hover{background:var(--dr-primary-dark,#4f46e5);}
.dr-cal-day.other-month{color:var(--dr-text-muted,#cbd5e1);}
.dr-cal-day:disabled{opacity:.4;cursor:not-allowed;}
.dr-time-row{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--dr-border-color,#e2e8f0);}
.dr-time-label{font-size:12px;color:var(--dr-text-muted,#94a3b8);flex-shrink:0;}
.dr-time-select{flex:1;padding:4px 8px;border:1px solid var(--dr-border-color,#e2e8f0);border-radius:var(--dr-border-radius,6px);font-size:13px;background:var(--dr-surface,#fff);color:inherit;}
.dr-tp-wrap{display:inline-flex;align-items:center;border:1px solid var(--dr-border-color,#e2e8f0);border-radius:var(--dr-border-radius,8px);background:var(--dr-surface,#fff);padding:0 8px;}
.dr-tp-wrap:focus-within{border-color:var(--dr-primary,#6366f1);}
.dr-tp-select{border:none;outline:none;background:transparent;padding:8px 4px;font-size:14px;color:inherit;cursor:pointer;}
    `;
    document.head.appendChild(s);
  };
})();

// ── DatePicker ─────────────────────────────────────────────────────────
export function DatePicker(props: DatePickerProps): HTMLElement {
  injectStyles();

  const fmt     = props.format ?? defaultFormat;
  const value$  = props.value  ?? signal<Date | null>(null);
  const disabled$ = typeof props.disabled === 'boolean'
    ? signal(props.disabled) : (props.disabled ?? signal(false));

  const view$   = signal<Date>(value$.peek() ?? new Date());
  const open$   = signal(false);

  // ── Wrap ─────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = `dr-dp-wrap${props.class ? ' ' + props.class : ''}`;

  // ── Input row ────────────────────────────────────────────────────────
  const inputRow = document.createElement('div');
  inputRow.className = 'dr-dp-input-row';

  const iconEl = document.createElement('span');
  iconEl.className = 'dr-dp-icon';
  iconEl.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

  const input = document.createElement('input');
  input.className = 'dr-dp-input';
  input.readOnly  = true;
  input.placeholder = props.placeholder ?? 'Select date';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'dr-dp-clear';
  clearBtn.textContent = '×';
  clearBtn.style.display = 'none';
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    value$.set(null);
    props.onChange?.(null);
  });

  inputRow.append(iconEl, input, clearBtn);

  // ── Calendar ──────────────────────────────────────────────────────────
  let calEl: HTMLElement | null = null;

  const buildCalendar = (): HTMLElement => {
    const cal = document.createElement('div');
    cal.className = 'dr-calendar';

    // Nav
    const nav = document.createElement('div');
    nav.className = 'dr-cal-nav';

    const prevYBtn = navBtn('«', () => view$.set(new Date(view$.peek().getFullYear() - 1, view$.peek().getMonth(), 1)));
    const prevMBtn = navBtn('‹', () => view$.set(new Date(view$.peek().getFullYear(), view$.peek().getMonth() - 1, 1)));
    const title    = document.createElement('div');
    title.className = 'dr-cal-title';
    const nextMBtn = navBtn('›', () => view$.set(new Date(view$.peek().getFullYear(), view$.peek().getMonth() + 1, 1)));
    const nextYBtn = navBtn('»', () => view$.set(new Date(view$.peek().getFullYear() + 1, view$.peek().getMonth(), 1)));

    nav.append(prevYBtn, prevMBtn, title, nextMBtn, nextYBtn);
    cal.appendChild(nav);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'dr-cal-grid';

    // Day names
    for (const d of DAY_NAMES) {
      const dn = document.createElement('div');
      dn.className = 'dr-cal-day-name';
      dn.textContent = d;
      grid.appendChild(dn);
    }

    const today   = new Date();
    const gridCells: HTMLButtonElement[] = [];

    const renderGrid = () => {
      const v   = view$.peek();
      const cur = value$.peek();
      title.textContent = `${MONTH_NAMES[v.getMonth()]} ${v.getFullYear()}`;

      while (grid.children.length > 7) grid.removeChild(grid.lastChild!);
      gridCells.length = 0;

      const first    = startOfMonth(v);
      const dow      = first.getDay(); // 0=Sun
      const dimMonth = daysInMonth(v.getFullYear(), v.getMonth());
      const prevDim  = daysInMonth(v.getFullYear(), v.getMonth() - 1);

      // Previous month fill
      for (let i = dow - 1; i >= 0; i--) {
        const d = new Date(v.getFullYear(), v.getMonth() - 1, prevDim - i);
        grid.appendChild(dayBtn(d, cur, today, 'other-month'));
      }
      // Current month
      for (let i = 1; i <= dimMonth; i++) {
        const d = new Date(v.getFullYear(), v.getMonth(), i);
        grid.appendChild(dayBtn(d, cur, today, ''));
      }
      // Next month fill
      const filled = dow + dimMonth;
      const cells  = Math.ceil(filled / 7) * 7;
      for (let i = 1; i <= cells - filled; i++) {
        const d = new Date(v.getFullYear(), v.getMonth() + 1, i);
        grid.appendChild(dayBtn(d, cur, today, 'other-month'));
      }
    };

    effect(() => { view$(); value$(); renderGrid(); });

    cal.appendChild(grid);

    // Time row
    if (props.showTime) {
      const timeRow = document.createElement('div');
      timeRow.className = 'dr-time-row';
      const lbl = document.createElement('span');
      lbl.className = 'dr-time-label';
      lbl.textContent = 'Time:';
      const hSel = timeSel(0, 23);
      const sep  = document.createElement('span');
      sep.textContent = ':';
      const mSel = timeSel(0, 59, 5);

      const cur = value$.peek();
      if (cur) { hSel.value = String(cur.getHours()); mSel.value = String(cur.getMinutes()); }

      const updateTime = () => {
        const d = value$.peek() ?? new Date();
        d.setHours(Number(hSel.value), Number(mSel.value));
        value$.set(new Date(d));
        props.onChange?.(value$.peek());
      };
      hSel.addEventListener('change', updateTime);
      mSel.addEventListener('change', updateTime);

      timeRow.append(lbl, hSel, sep, mSel);
      cal.appendChild(timeRow);
    }

    return cal;
  };

  function navBtn(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'dr-cal-nav-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function dayBtn(d: Date, selected: Date | null, today: Date, extra: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = ['dr-cal-day', extra,
      selected && isSameDay(d, selected) ? 'selected' : '',
      isSameDay(d, today) ? 'today' : '',
    ].filter(Boolean).join(' ');
    b.textContent = String(d.getDate());

    if (props.min && d < props.min) b.disabled = true;
    if (props.max && d > props.max) b.disabled = true;

    b.addEventListener('click', () => {
      const prev = value$.peek();
      const next = new Date(d);
      if (prev && props.showTime) {
        next.setHours(prev.getHours(), prev.getMinutes());
      }
      value$.set(next);
      props.onChange?.(next);
      if (!props.showTime) open$.set(false);
    });
    return b;
  }

  function timeSel(min: number, max: number, step = 1): HTMLSelectElement {
    const s = document.createElement('select');
    s.className = 'dr-time-select';
    for (let i = min; i <= max; i += step) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = pad(i);
      s.appendChild(o);
    }
    return s;
  }

  // ── Toggle calendar ───────────────────────────────────────────────────
  inputRow.addEventListener('click', () => {
    if (disabled$.peek()) return;
    open$.set(!open$.peek());
  });

  const onOutside = (e: MouseEvent) => {
    if (!wrap.contains(e.target as Node)) open$.set(false);
  };

  // ── Reactive updates ──────────────────────────────────────────────────
  effect(() => {
    const v = value$();
    input.value = v ? fmt(v) : '';
    clearBtn.style.display = (v && props.clearable !== false) ? '' : 'none';
    if (v) view$.set(v);
  });

  effect(() => {
    const isOpen = open$();
    if (isOpen) {
      document.addEventListener('mousedown', onOutside);
      calEl = buildCalendar();
      wrap.appendChild(calEl);
    } else {
      document.removeEventListener('mousedown', onOutside);
      calEl?.remove();
      calEl = null;
    }
  });

  effect(() => {
    const dis = disabled$();
    inputRow.style.opacity  = dis ? '0.5' : '';
    inputRow.style.cursor   = dis ? 'not-allowed' : '';
  });

  wrap.appendChild(inputRow);
  return wrap;
}

// ── TimePicker ─────────────────────────────────────────────────────────
export function TimePicker(props: TimePickerProps): HTMLElement {
  injectStyles();

  const value$    = props.value ?? signal<string | null>(null);
  const disabled$ = typeof props.disabled === 'boolean'
    ? signal(props.disabled) : (props.disabled ?? signal(false));
  const step      = props.step ?? 30;

  const wrap = document.createElement('div');
  wrap.className = `dr-tp-wrap${props.class ? ' ' + props.class : ''}`;

  const hSel = document.createElement('select');
  hSel.className = 'dr-tp-select';
  for (let h = 0; h < 24; h++) {
    const o = document.createElement('option');
    o.value = pad(h); o.textContent = pad(h);
    hSel.appendChild(o);
  }

  const sep = document.createElement('span');
  sep.textContent = ':';
  sep.style.color = 'var(--dr-text-muted,#94a3b8)';

  const mSel = document.createElement('select');
  mSel.className = 'dr-tp-select';
  for (let m = 0; m < 60; m += step) {
    const o = document.createElement('option');
    o.value = pad(m); o.textContent = pad(m);
    mSel.appendChild(o);
  }

  const update = () => {
    const val = `${hSel.value}:${mSel.value}`;
    value$.set(val);
    props.onChange?.(val);
  };
  hSel.addEventListener('change', update);
  mSel.addEventListener('change', update);

  effect(() => {
    const v = value$();
    if (v) {
      const [h = '00', m = '00'] = v.split(':');
      hSel.value = h; mSel.value = m;
    }
    const dis = disabled$();
    hSel.disabled = dis; mSel.disabled = dis;
    wrap.style.opacity = dis ? '0.5' : '';
  });

  wrap.append(hSel, sep, mSel);
  return wrap;
}
