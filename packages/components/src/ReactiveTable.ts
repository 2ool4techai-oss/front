import { signal, effect, computed } from '@drishti/runtime';
import { sanitizeInput } from '@drishti/runtime';

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  width?: string;
  format?: (v: unknown, row: T) => string;
  sortable?: boolean;
}

export interface ReactiveTableProps<T extends Record<string, unknown>> {
  data: () => T[];
  columns: TableColumn<T>[];
  searchable?: boolean;
  pageSize?: number;
  loading?: () => boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function ReactiveTable<T extends Record<string, unknown>>(props: ReactiveTableProps<T>): HTMLElement {
  const searchQuery = signal('');
  const sortKey = signal<keyof T | null>(null);
  const sortDir = signal<'asc' | 'desc'>('asc');
  const page = signal(0);
  const pageSize = props.pageSize ?? 10;

  const filtered = computed(() => {
    const q = searchQuery().toLowerCase().trim();
    const rows = props.data();
    if (!q) return rows;
    return rows.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(q))
    );
  });

  const sorted = computed(() => {
    const rows = [...filtered()];
    const key = sortKey();
    if (!key) return rows;
    const dir = sortDir() === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  });

  const paginated = computed(() => {
    const p = page();
    return sorted().slice(p * pageSize, (p + 1) * pageSize);
  });

  const totalPages = computed(() => Math.ceil(filtered().length / pageSize));

  const wrap = document.createElement('div');
  wrap.style.cssText = 'font-family:var(--dr-font-family,system-ui);border-radius:var(--dr-border-radius,6px);overflow:hidden;box-shadow:var(--dr-shadow,0 2px 8px rgba(0,0,0,.12));background:#fff;';

  if (props.searchable) {
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:12px 16px;border-bottom:1px solid #e5e7eb;';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search…';
    input.style.cssText = 'width:100%;padding:6px 12px;border:1.5px solid #d1d5db;border-radius:var(--dr-border-radius,6px);font-size:.875rem;outline:none;box-sizing:border-box;font-family:inherit;';
    input.addEventListener('input', () => {
      searchQuery.set(sanitizeInput(input.value));
      page.set(0);
    });
    input.addEventListener('focus', () => { input.style.borderColor = 'var(--dr-color-primary,#2D6BE4)'; });
    input.addEventListener('blur', () => { input.style.borderColor = '#d1d5db'; });
    searchWrap.appendChild(input);
    wrap.appendChild(searchWrap);
  }

  const tableWrap = document.createElement('div');
  tableWrap.style.cssText = 'overflow-x:auto;';
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:.875rem;';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.style.cssText = 'background:#f9fafb;';

  for (const col of props.columns) {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.style.cssText = `padding:10px 16px;text-align:left;font-weight:600;color:#374151;white-space:nowrap;${col.width ? `width:${col.width};` : ''}`;
    if (col.sortable !== false) {
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.addEventListener('click', () => {
        if (sortKey.peek() === col.key) {
          sortDir.set(sortDir.peek() === 'asc' ? 'desc' : 'asc');
        } else {
          sortKey.set(col.key);
          sortDir.set('asc');
        }
        page.set(0);
      });

      effect(() => {
        const active = sortKey() === col.key;
        const dir = sortDir();
        th.textContent = col.label + (active ? (dir === 'asc' ? ' ↑' : ' ↓') : '');
        th.style.color = active ? 'var(--dr-color-primary,#2D6BE4)' : '#374151';
      });
    }
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  const loadingEl = document.createElement('div');
  loadingEl.style.cssText = 'padding:32px;text-align:center;color:#888;font-size:.875rem;';
  loadingEl.textContent = 'Loading…';

  const emptyEl = document.createElement('div');
  emptyEl.style.cssText = 'padding:32px;text-align:center;color:#aaa;font-size:.875rem;';
  emptyEl.textContent = props.emptyMessage ?? 'No data found';

  effect(() => {
    const isLoading = props.loading?.() ?? false;
    const rows = paginated();

    loadingEl.style.display = isLoading ? 'block' : 'none';
    tableWrap.style.display = isLoading ? 'none' : 'block';

    if (!isLoading && rows.length === 0) {
      tbody.innerHTML = '';
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      tbody.innerHTML = '';
      rows.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.style.cssText = `border-top:1px solid #e5e7eb;transition:background var(--dr-transition-speed,200ms);${i % 2 ? 'background:#fafafa;' : ''}`;

        if (props.onRowClick) {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => props.onRowClick!(row));
          tr.addEventListener('mouseenter', () => { tr.style.background = '#eff6ff'; });
          tr.addEventListener('mouseleave', () => { tr.style.background = i % 2 ? '#fafafa' : ''; });
        }

        for (const col of props.columns) {
          const td = document.createElement('td');
          const raw = row[col.key as string];
          td.textContent = col.format ? col.format(raw, row) : sanitizeInput(String(raw ?? ''));
          td.style.cssText = 'padding:10px 16px;color:#111827;';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    }
  });

  const pagination = document.createElement('div');
  pagination.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid #e5e7eb;font-size:.8rem;color:#666;';

  const info = document.createElement('span');
  const prevBtn = document.createElement('button');
  prevBtn.textContent = '← Prev';
  prevBtn.style.cssText = 'padding:4px 12px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;background:#fff;font-size:.8rem;';
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next →';
  nextBtn.style.cssText = prevBtn.style.cssText;

  prevBtn.addEventListener('click', () => page.set(Math.max(0, page.peek() - 1)));
  nextBtn.addEventListener('click', () => page.set(Math.min(totalPages.peek() - 1, page.peek() + 1)));

  effect(() => {
    const p = page();
    const total = totalPages();
    const count = filtered().length;
    const start = p * pageSize + 1;
    const end = Math.min((p + 1) * pageSize, count);
    info.textContent = count > 0 ? `${start}–${end} of ${count}` : '';
    (prevBtn as HTMLButtonElement).disabled = p === 0;
    (nextBtn as HTMLButtonElement).disabled = p >= total - 1;
    prevBtn.style.opacity = p === 0 ? '0.4' : '1';
    nextBtn.style.opacity = p >= total - 1 ? '0.4' : '1';
  });

  pagination.appendChild(info);
  const paginationBtns = document.createElement('div');
  paginationBtns.style.cssText = 'display:flex;gap:8px;';
  paginationBtns.appendChild(prevBtn);
  paginationBtns.appendChild(nextBtn);
  pagination.appendChild(paginationBtns);

  wrap.appendChild(tableWrap);
  wrap.appendChild(loadingEl);
  wrap.appendChild(emptyEl);
  wrap.appendChild(pagination);

  return wrap;
}
