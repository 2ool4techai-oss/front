injectSkeletonStyles();

export type SkeletonVariant = 'text' | 'rect' | 'circle' | 'card';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?:   string | number;
  height?:  string | number;
  lines?:   number;       // for 'text' variant
  class?:   string;
}

// ── Skeleton ───────────────────────────────────────────────────────────
export function Skeleton(props: SkeletonProps = {}): HTMLElement {
  const variant = props.variant ?? 'rect';

  if (variant === 'text') {
    return skeletonText(props.lines ?? 3, props.class);
  }

  const el = document.createElement('span');
  el.className = `dr-skeleton dr-skeleton--${variant}${props.class ? ` ${props.class}` : ''}`;
  if (props.width)  el.style.width  = typeof props.width  === 'number' ? `${props.width}px`  : props.width;
  if (props.height) el.style.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
  return el;
}

function skeletonText(lines: number, cls?: string): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = `dr-skeleton-text${cls ? ` ${cls}` : ''}`;
  for (let i = 0; i < lines; i++) {
    const line = document.createElement('span');
    line.className = 'dr-skeleton dr-skeleton--text-line';
    // Last line is shorter (natural text ending)
    if (i === lines - 1) line.style.width = `${55 + Math.floor(Math.random() * 20)}%`;
    wrap.appendChild(line);
  }
  return wrap;
}

// ── SkeletonCard — full card placeholder ──────────────────────────────
export function SkeletonCard(opts: { rows?: number; hasImage?: boolean; class?: string } = {}): HTMLDivElement {
  const card = document.createElement('div');
  card.className = `dr-skeleton-card${opts.class ? ` ${opts.class}` : ''}`;

  if (opts.hasImage !== false) {
    const img = document.createElement('span');
    img.className = 'dr-skeleton dr-skeleton--rect dr-skeleton-card__img';
    card.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'dr-skeleton-card__body';

  // Title
  const title = document.createElement('span');
  title.className = 'dr-skeleton dr-skeleton--rect dr-skeleton-card__title';
  body.appendChild(title);

  // Rows
  const rows = opts.rows ?? 2;
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('span');
    row.className = 'dr-skeleton dr-skeleton--text-line';
    if (i === rows - 1) row.style.width = '60%';
    body.appendChild(row);
  }

  card.appendChild(body);
  return card;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectSkeletonStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'skeleton';
  s.textContent = `
.dr-skeleton {
  display:block;
  background: linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.05) 75%);
  background-size: 200% 100%;
  animation: dr-shimmer calc(1.5s/max(var(--dr-adapt-speed,1),.3)) ease infinite;
  border-radius: calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1)*0.5);
}
@keyframes dr-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
.dr-skeleton--text-line { height:.8em; width:100%; margin-bottom:.5em; border-radius:4px; }
.dr-skeleton--rect  { width:100%; height:120px; }
.dr-skeleton--circle { width:40px; height:40px; border-radius:50%; }
.dr-skeleton-text { display:flex; flex-direction:column; width:100%; }
.dr-skeleton-card { border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1)); overflow:hidden; border:1px solid var(--dr-color-border,rgba(255,255,255,.1)); }
.dr-skeleton-card__img { height:160px; border-radius:0; }
.dr-skeleton-card__body { padding:16px; display:flex; flex-direction:column; gap:8px; }
.dr-skeleton-card__title { height:1.2em; width:70%; border-radius:4px; }
`;
  document.head.appendChild(s);
}
