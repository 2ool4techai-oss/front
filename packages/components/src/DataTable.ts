import { signal, computed, effect, batch } from '@nexoraaidrishti/runtime';
import type { Signal, ComputedSignal } from '@nexoraaidrishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc' | 'none';

export interface TableColumn<T = Record<string, unknown>> {
  key:         string;
  label:       string;
  sortable?:   boolean;
  filterable?: boolean;
  width?:      string;        // e.g. '120px'
  minWidth?:   string;
  align?:      'left' | 'center' | 'right';
  type?:       'string' | 'number' | 'boolean' | 'date';
  render?:     (value: unknown, row: T, index: number) => HTMLElement | string;
  class?:      string;
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns:       TableColumn<T>[];
  data:          Signal<T[]> | T[];
  pageSize?:     number;
  pageSizes?:    number[];
  selectable?:   boolean | 'single' | 'multi';
  loading?:      Signal<boolean> | boolean;
  emptyMessage?: string;
  searchable?:   boolean;
  striped?:      boolean;
  bordered?:     boolean;
  compact?:      boolean;
  stickyHeader?: boolean;
  height?:       string;          // set for virtual scroll
  rowKey?:       (row: T) => string;
  onSort?:       (key: string, dir: SortDir) => void;
  onSelect?:     (rows: T[]) => void;
  onRowClick?:   (row: T, index: number) => void;
  class?:        string;
}

export interface DataTableHandle<T = Record<string, unknown>> {
  el:            HTMLElement;
  selectedRows:  ComputedSignal<T[]>;
  clearSelection(): void;
  selectAll():    void;
  goToPage(p: number): void;
  search(q: string): void;
  destroy():      void;
}

// ── Styles ─────────────────────────────────────────────────────────────
const injectStyles = (() => {
  let done = false;
  return () => {
    if (done || typeof document === 'undefined') return;
    done = true;
    const s = document.createElement('style');
    s.textContent = `
.dr-table-wrap{--dr-table-border:var(--dr-border-color,#e2e8f0);--dr-table-head-bg:var(--dr-surface-high,#f8fafc);--dr-table-row-hover:var(--dr-surface-high,#f1f5f9);--dr-table-stripe:var(--dr-surface,#f8fafc);font-family:inherit;font-size:14px;line-height:1.5;}
.dr-table-toolbar{display:flex;align-items:center;gap:10px;padding:10px 0;flex-wrap:wrap;}
.dr-table-search{flex:1;min-width:200px;padding:6px 12px;border:1px solid var(--dr-table-border);border-radius:var(--dr-border-radius,6px);font-size:13px;background:var(--dr-surface,#fff);color:inherit;outline:none;}
.dr-table-search:focus{border-color:var(--dr-primary,#6366f1);box-shadow:0 0 0 3px color-mix(in srgb,var(--dr-primary,#6366f1) 15%,transparent);}
.dr-table-info{color:var(--dr-text-muted,#64748b);font-size:12px;white-space:nowrap;}
.dr-table-outer{overflow:auto;border:1px solid var(--dr-table-border);border-radius:var(--dr-border-radius,8px);}
.dr-table-outer.sticky-header{overflow-y:auto;}
table.dr-table{width:100%;border-collapse:collapse;table-layout:fixed;}
table.dr-table th{padding:10px 12px;background:var(--dr-table-head-bg);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--dr-text-muted,#64748b);border-bottom:2px solid var(--dr-table-border);user-select:none;white-space:nowrap;position:relative;}
table.dr-table.compact th{padding:6px 10px;}
table.dr-table th.sortable{cursor:pointer;}
table.dr-table th.sortable:hover{background:var(--dr-table-row-hover);}
.dr-th-inner{display:flex;align-items:center;gap:6px;}
.dr-sort-icon{display:inline-flex;flex-direction:column;gap:1px;opacity:.35;transition:opacity .15s;}
.dr-sort-icon.active{opacity:1;color:var(--dr-primary,#6366f1);}
.dr-sort-up,.dr-sort-down{width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;}
.dr-sort-up{border-bottom:4px solid currentColor;}
.dr-sort-down{border-top:4px solid currentColor;}
table.dr-table td{padding:10px 12px;border-bottom:1px solid var(--dr-table-border);word-break:break-word;transition:background .1s;}
table.dr-table.compact td{padding:6px 10px;}
table.dr-table.striped tbody tr:nth-child(even) td{background:var(--dr-table-stripe);}
table.dr-table tbody tr:hover td{background:var(--dr-table-row-hover);}
table.dr-table.bordered td,table.dr-table.bordered th{border:1px solid var(--dr-table-border);}
table.dr-table td.text-right,table.dr-table th.text-right{text-align:right;}
table.dr-table td.text-center,table.dr-table th.text-center{text-align:center;}
.dr-table-cb{width:40px!important;min-width:40px;padding:0!important;text-align:center!important;}
.dr-table-empty{text-align:center;padding:32px;color:var(--dr-text-muted,#94a3b8);}
.dr-table-loading-row td{padding:24px;text-align:center;color:var(--dr-text-muted,#94a3b8);}
.dr-table-footer{display:flex;align-items:center;justify-content:space-between;padding:10px 4px;gap:10px;flex-wrap:wrap;}
.dr-table-page-info{font-size:13px;color:var(--dr-text-muted,#64748b);}
.dr-table-pagination{display:flex;gap:4px;align-items:center;}
.dr-page-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid var(--dr-table-border);border-radius:var(--dr-border-radius,6px);background:var(--dr-surface,#fff);cursor:pointer;font-size:13px;color:inherit;transition:all .15s;}
.dr-page-btn:hover:not(:disabled){border-color:var(--dr-primary,#6366f1);color:var(--dr-primary,#6366f1);}
.dr-page-btn.active{background:var(--dr-primary,#6366f1);color:#fff;border-color:var(--dr-primary,#6366f1);}
.dr-page-btn:disabled{opacity:.4;cursor:not-allowed;}
.dr-page-size-select{padding:4px 8px;border:1px solid var(--dr-table-border);border-radius:var(--dr-border-radius,6px);font-size:13px;background:var(--dr-surface,#fff);color:inherit;cursor:pointer;}
    `;
    document.head.appendChild(s);
  };
})();

// ── DataTable ──────────────────────────────────────────────────────────
export function DataTable<T extends Record<string, unknown>>(
  props: DataTableProps<T>,
): DataTableHandle<T> {
  injectStyles();

  const pageSize$    = signal(props.pageSize ?? 20);
  const page$        = signal(1);
  const sortKey$     = signal('');
  const sortDir$     = signal<SortDir>('none');
  const searchQ$     = signal('');
  const selected$    = signal<Set<string>>(new Set());
  const disposers:   Array<() => void> = [];

  const dataSignal   = typeof props.data === 'function'
    ? props.data as Signal<T[]>
    : signal(props.data as T[]);

  const loadingSignal = props.loading !== undefined
    ? (typeof props.loading === 'boolean' ? signal(props.loading) : props.loading)
    : signal(false);

  const rowKey = props.rowKey ?? ((r: T, i: number) => String((r as Record<string, unknown>)['id'] ?? i));

  // ── Derived data ────────────────────────────────────────────────────
  const filtered$ = computed((): T[] => {
    const q = searchQ$().toLowerCase().trim();
    let rows = dataSignal();
    if (q && props.searchable !== false) {
      rows = rows.filter(r =>
        Object.values(r).some(v => String(v).toLowerCase().includes(q))
      );
    }
    return rows;
  });

  const sorted$ = computed((): T[] => {
    const key = sortKey$();
    const dir = sortDir$();
    if (!key || dir === 'none') return filtered$();
    return [...filtered$()].sort((a, b) => {
      const av = a[key]; const bv = b[key];
      const cmp = av == null ? -1 : bv == null ? 1
        : typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  const totalPages$ = computed(() => Math.max(1, Math.ceil(sorted$().length / pageSize$())));

  const paged$ = computed((): T[] => {
    const p = page$(); const ps = pageSize$();
    return sorted$().slice((p - 1) * ps, p * ps);
  });

  const selectedRows$ = computed((): T[] => {
    const ids = selected$();
    return dataSignal().filter((r, i) => ids.has(rowKey(r, i)));
  });

  // ── Container ───────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = `dr-table-wrap${props.class ? ' ' + props.class : ''}`;

  // ── Toolbar ─────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.className = 'dr-table-toolbar';

  let searchInput: HTMLInputElement | undefined;
  if (props.searchable !== false) {
    searchInput = document.createElement('input');
    searchInput.className = 'dr-table-search';
    searchInput.placeholder = 'Search…';
    searchInput.addEventListener('input', () => {
      batch(() => { searchQ$.set(searchInput!.value); page$.set(1); });
    });
    toolbar.appendChild(searchInput);
  }

  const infoEl = document.createElement('div');
  infoEl.className = 'dr-table-info';
  toolbar.appendChild(infoEl);
  wrap.appendChild(toolbar);

  // ── Table outer ──────────────────────────────────────────────────────
  const outer = document.createElement('div');
  outer.className = `dr-table-outer${props.stickyHeader ? ' sticky-header' : ''}`;
  if (props.height) outer.style.maxHeight = props.height;

  const table = document.createElement('table');
  table.className = [
    'dr-table',
    props.striped  ? 'striped'  : '',
    props.bordered ? 'bordered' : '',
    props.compact  ? 'compact'  : '',
  ].filter(Boolean).join(' ');

  // ── Colgroup ─────────────────────────────────────────────────────────
  const colgroup = document.createElement('colgroup');
  if (props.selectable) {
    const col = document.createElement('col');
    col.style.width = '40px';
    colgroup.appendChild(col);
  }
  for (const c of props.columns) {
    const col = document.createElement('col');
    if (c.width) col.style.width = c.width;
    else if (c.minWidth) col.style.minWidth = c.minWidth;
    colgroup.appendChild(col);
  }
  table.appendChild(colgroup);

  // ── Header ───────────────────────────────────────────────────────────
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Select-all checkbox
  let selectAllCb: HTMLInputElement | undefined;
  if (props.selectable && props.selectable !== 'single') {
    const th = document.createElement('th');
    th.className = 'dr-table-cb';
    selectAllCb = document.createElement('input');
    selectAllCb.type = 'checkbox';
    selectAllCb.addEventListener('change', () => {
      if (selectAllCb!.checked) {
        const ids = new Set(paged$().map((r, i) => rowKey(r, i)));
        selected$.set(ids);
      } else {
        selected$.set(new Set());
      }
      props.onSelect?.(selectedRows$.peek());
    });
    th.appendChild(selectAllCb);
    headerRow.appendChild(th);
  }

  for (const col of props.columns) {
    const th = document.createElement('th');
    if (col.sortable) th.className = 'sortable';
    if (col.align) th.classList.add(`text-${col.align}`);
    if (col.class) th.classList.add(col.class);

    const inner = document.createElement('div');
    inner.className = 'dr-th-inner';
    const label = document.createElement('span');
    label.textContent = col.label;
    inner.appendChild(label);

    if (col.sortable) {
      const icon = document.createElement('span');
      icon.className = 'dr-sort-icon';
      const up = document.createElement('span'); up.className = 'dr-sort-up';
      const dn = document.createElement('span'); dn.className = 'dr-sort-down';
      icon.append(up, dn);
      inner.appendChild(icon);

      disposers.push(effect(() => {
        const active = sortKey$() === col.key && sortDir$() !== 'none';
        icon.classList.toggle('active', active);
      }));

      th.addEventListener('click', () => {
        batch(() => {
          if (sortKey$() !== col.key) {
            sortKey$.set(col.key); sortDir$.set('asc');
          } else {
            const next: SortDir = sortDir$() === 'asc' ? 'desc' : sortDir$() === 'desc' ? 'none' : 'asc';
            sortDir$.set(next);
            if (next === 'none') sortKey$.set('');
          }
          page$.set(1);
        });
        props.onSort?.(col.key, sortDir$.peek());
      });
    }

    th.appendChild(inner);
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ── Body ─────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  outer.appendChild(table);
  wrap.appendChild(outer);

  // ── Footer ───────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'dr-table-footer';

  const pageInfo = document.createElement('div');
  pageInfo.className = 'dr-table-page-info';

  const pageSizes = props.pageSizes ?? [10, 20, 50, 100];
  const pageSizeSelect = document.createElement('select');
  pageSizeSelect.className = 'dr-page-size-select';
  for (const ps of pageSizes) {
    const opt = document.createElement('option');
    opt.value = String(ps); opt.textContent = `${ps} / page`;
    if (ps === (props.pageSize ?? 20)) opt.selected = true;
    pageSizeSelect.appendChild(opt);
  }
  pageSizeSelect.addEventListener('change', () => {
    batch(() => { pageSize$.set(Number(pageSizeSelect.value)); page$.set(1); });
  });

  const pagination = document.createElement('div');
  pagination.className = 'dr-table-pagination';
  footer.append(pageInfo, pageSizeSelect, pagination);
  wrap.appendChild(footer);

  // ── Render rows ──────────────────────────────────────────────────────
  const renderRows = () => {
    tbody.innerHTML = '';

    if (loadingSignal.peek()) {
      const tr = document.createElement('tr');
      tr.className = 'dr-table-loading-row';
      const td = document.createElement('td');
      td.colSpan = props.columns.length + (props.selectable ? 1 : 0);
      td.textContent = 'Loading…';
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }

    const rows = paged$();
    if (rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'dr-table-empty';
      td.colSpan = props.columns.length + (props.selectable ? 1 : 0);
      td.textContent = props.emptyMessage ?? 'No data';
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }

    const ids = selected$();
    for (let i = 0; i < rows.length; i++) {
      const row   = rows[i]!;
      const rowId = rowKey(row, i);
      const tr    = document.createElement('tr');

      if (props.selectable) {
        const td = document.createElement('td');
        td.className = 'dr-table-cb';
        const cb = document.createElement('input');
        cb.type = props.selectable === 'single' ? 'radio' : 'checkbox';
        cb.checked = ids.has(rowId);
        cb.addEventListener('change', () => {
          const cur = new Set(selected$.peek());
          if (props.selectable === 'single') {
            cur.clear();
            if (cb.checked) cur.add(rowId);
          } else {
            if (cb.checked) cur.add(rowId); else cur.delete(rowId);
          }
          selected$.set(cur);
          props.onSelect?.(selectedRows$.peek());
          if (selectAllCb) {
            const pageIds = paged$().map((r, j) => rowKey(r, j));
            selectAllCb.checked = pageIds.every(id => cur.has(id));
          }
        });
        td.appendChild(cb); tr.appendChild(td);
      }

      for (const col of props.columns) {
        const td = document.createElement('td');
        if (col.align) td.classList.add(`text-${col.align}`);
        if (col.class) td.classList.add(col.class);

        const val = row[col.key];
        if (col.render) {
          const rendered = col.render(val, row, i);
          if (typeof rendered === 'string') td.innerHTML = rendered;
          else td.appendChild(rendered);
        } else {
          td.textContent = val != null ? String(val) : '';
        }
        tr.appendChild(td);
      }

      if (props.onRowClick) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => props.onRowClick!(row, i));
      }

      tbody.appendChild(tr);
    }
  };

  // ── Render pagination ────────────────────────────────────────────────
  const renderPagination = () => {
    const total  = sorted$().length;
    const p      = page$();
    const ps     = pageSize$();
    const tp     = totalPages$();
    const from   = (p - 1) * ps + 1;
    const to     = Math.min(p * ps, total);

    pageInfo.textContent = total === 0 ? 'No results' : `${from}–${to} of ${total}`;
    pagination.innerHTML = '';

    const prevBtn = pageBtn('‹', p <= 1, () => page$.set(p - 1));
    pagination.appendChild(prevBtn);

    const range = buildPageRange(p, tp);
    for (const pg of range) {
      if (pg === '…') {
        const span = document.createElement('span');
        span.textContent = '…';
        span.style.padding = '0 4px';
        pagination.appendChild(span);
      } else {
        const num = pg as number;
        const btn = pageBtn(String(num), false, () => page$.set(num));
        if (num === p) btn.classList.add('active');
        pagination.appendChild(btn);
      }
    }

    const nextBtn = pageBtn('›', p >= tp, () => page$.set(p + 1));
    pagination.appendChild(nextBtn);
  };

  function pageBtn(label: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'dr-page-btn';
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function buildPageRange(cur: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (cur > 3) pages.push('…');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }

  // ── Info bar ─────────────────────────────────────────────────────────
  const renderInfo = () => {
    const sel = selected$().size;
    infoEl.textContent = sel > 0 ? `${sel} selected` : `${sorted$().length} rows`;
  };

  // ── Wire up reactive renders ─────────────────────────────────────────
  disposers.push(effect(() => {
    loadingSignal(); paged$(); selected$();
    renderRows();
  }));
  disposers.push(effect(() => {
    page$(); totalPages$(); sorted$();
    renderPagination();
  }));
  disposers.push(effect(() => {
    sorted$(); selected$();
    renderInfo();
  }));

  return {
    el: wrap,
    selectedRows: selectedRows$,
    clearSelection: () => selected$.set(new Set()),
    selectAll: () => {
      const ids = new Set(dataSignal().map((r, i) => rowKey(r, i)));
      selected$.set(ids);
    },
    goToPage: (p) => page$.set(Math.max(1, Math.min(p, totalPages$.peek()))),
    search: (q) => { searchQ$.set(q); if (searchInput) searchInput.value = q; },
    destroy: () => { for (const d of disposers) d(); },
  };
}
