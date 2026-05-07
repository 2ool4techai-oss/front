export type SpinnerSize    = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'ring' | 'dots' | 'pulse' | 'bar';

export interface SpinnerProps {
  size?:    SpinnerSize;
  variant?: SpinnerVariant;
  color?:   string;   // CSS color override
  label?:   string;   // accessible label
  class?:   string;
}

// ── Badge ──────────────────────────────────────────────────────────────
export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  text:       string;
  variant?:   BadgeVariant;
  dot?:       boolean;   // show pulsing dot
  removable?: boolean;
  onRemove?:  () => void;
  class?:     string;
}

// ── Avatar ─────────────────────────────────────────────────────────────
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps {
  src?:     string;
  alt?:     string;
  name?:    string;   // used for initials fallback
  size?:    AvatarSize;
  status?:  'online' | 'offline' | 'away' | 'busy';
  class?:   string;
}

export interface AvatarGroupProps {
  avatars:  AvatarProps[];
  max?:     number;
  size?:    AvatarSize;
  class?:   string;
}

injectUtilStyles();

// ── Spinner ────────────────────────────────────────────────────────────
export function Spinner(props: SpinnerProps = {}): HTMLSpanElement {
  const size    = props.size    ?? 'md';
  const variant = props.variant ?? 'ring';

  const el = document.createElement('span');
  el.className = `dr-spinner dr-spinner--${variant} dr-spinner--${size}${props.class ? ` ${props.class}` : ''}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', props.label ?? 'Loading…');
  if (props.color) el.style.color = props.color;

  switch (variant) {
    case 'ring':
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity=".2" stroke-width="2.5"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
      break;
    case 'dots':
      el.innerHTML = `<span></span><span></span><span></span>`;
      break;
    case 'pulse':
      el.innerHTML = `<span></span>`;
      break;
    case 'bar':
      el.innerHTML = `<span></span><span></span><span></span><span></span>`;
      break;
  }

  return el;
}

// ── Badge ──────────────────────────────────────────────────────────────
export function Badge(props: BadgeProps): HTMLSpanElement {
  const variant = props.variant ?? 'default';

  const el = document.createElement('span');
  el.className = `dr-badge dr-badge--${variant}${props.class ? ` ${props.class}` : ''}`;

  if (props.dot) {
    const dot = document.createElement('span');
    dot.className = 'dr-badge__dot';
    el.appendChild(dot);
  }

  const text = document.createElement('span');
  text.textContent = props.text;
  el.appendChild(text);

  if (props.removable) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dr-badge__remove';
    btn.setAttribute('aria-label', 'Remove');
    btn.innerHTML = `<svg viewBox="0 0 12 12" fill="currentColor"><path d="M9 3L6 6m0 0L3 9m3-3L9 9M6 6L3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); props.onRemove?.(); });
    el.appendChild(btn);
  }

  return el;
}

// ── Avatar ─────────────────────────────────────────────────────────────
export function Avatar(props: AvatarProps = {}): HTMLSpanElement {
  const size = props.size ?? 'md';

  const wrap = document.createElement('span');
  wrap.className = `dr-avatar dr-avatar--${size}${props.class ? ` ${props.class}` : ''}`;

  if (props.src) {
    const img = document.createElement('img');
    img.src = props.src;
    img.alt = props.alt ?? props.name ?? '';
    img.className = 'dr-avatar__img';
    img.addEventListener('error', () => {
      img.remove();
      wrap.appendChild(initialsEl(props.name ?? props.alt ?? '?'));
    });
    wrap.appendChild(img);
  } else {
    wrap.appendChild(initialsEl(props.name ?? props.alt ?? '?'));
  }

  if (props.status) {
    const dot = document.createElement('span');
    dot.className = `dr-avatar__status dr-avatar__status--${props.status}`;
    wrap.appendChild(dot);
  }

  return wrap;
}

function initialsEl(name: string): HTMLSpanElement {
  const words    = name.trim().split(/\s+/);
  const initials = words.length >= 2
    ? `${words[0]![0]}${words[words.length - 1]![0]}`
    : (words[0]?.[0] ?? '?');

  const el = document.createElement('span');
  el.className    = 'dr-avatar__initials';
  el.textContent  = initials.toUpperCase();
  el.style.background = colorFromName(name);
  return el;
}

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = ((hash % 360) + 360) % 360;
  return `hsl(${h}, 50%, 35%)`;
}

// ── AvatarGroup ────────────────────────────────────────────────────────
export function AvatarGroup(props: AvatarGroupProps): HTMLSpanElement {
  const max    = props.max ?? 4;
  const size   = props.size ?? 'md';
  const shown  = props.avatars.slice(0, max);
  const extra  = props.avatars.length - max;

  const wrap = document.createElement('span');
  wrap.className = `dr-avatar-group${props.class ? ` ${props.class}` : ''}`;

  shown.forEach(av => {
    const a = Avatar({ ...av, size });
    wrap.appendChild(a);
  });

  if (extra > 0) {
    const more = document.createElement('span');
    more.className = `dr-avatar dr-avatar--${size} dr-avatar--more`;
    more.textContent = `+${extra}`;
    wrap.appendChild(more);
  }

  return wrap;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectUtilStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'utils';
  s.textContent = `
/* ── Spinner ──────────────────────────────────────────────────────── */
.dr-spinner { display:inline-flex; align-items:center; justify-content:center; color:var(--dr-color-primary,#3b82f6); flex-shrink:0; }
.dr-spinner--xs { width:14px; height:14px; } .dr-spinner--sm { width:18px; height:18px; }
.dr-spinner--md { width:24px; height:24px; } .dr-spinner--lg { width:32px; height:32px; }
.dr-spinner--xl { width:44px; height:44px; }
.dr-spinner--ring svg { width:100%; height:100%; animation:dr-spin calc(.7s*var(--dr-adapt-speed,1)) linear infinite; }
@keyframes dr-spin { to { transform:rotate(360deg); } }
.dr-spinner--dots { gap:calc(3px*var(--dr-adapt-radius,1)); }
.dr-spinner--dots span { width:.35em; height:.35em; border-radius:50%; background:currentColor; animation:dr-dots 1.2s ease infinite; }
.dr-spinner--dots span:nth-child(2) { animation-delay:.2s; }
.dr-spinner--dots span:nth-child(3) { animation-delay:.4s; }
@keyframes dr-dots { 0%,80%,100% { transform:scale(.6); opacity:.3; } 40% { transform:scale(1); opacity:1; } }
.dr-spinner--pulse span { width:1em; height:1em; border-radius:50%; background:currentColor; animation:dr-pulse calc(1s*var(--dr-adapt-speed,1)) ease infinite; }
@keyframes dr-pulse { 0%,100% { transform:scale(.6); opacity:.3; } 50% { transform:scale(1); opacity:1; } }
.dr-spinner--bar { gap:2px; align-items:flex-end; }
.dr-spinner--bar span { width:3px; border-radius:2px; background:currentColor; animation:dr-bar calc(.9s*var(--dr-adapt-speed,1)) ease infinite; }
.dr-spinner--xs .dr-spinner--bar span,.dr-spinner--sm .dr-spinner--bar span { height:10px; }
.dr-spinner--md .dr-spinner--bar span { height:14px; }
.dr-spinner--lg .dr-spinner--bar span,.dr-spinner--xl .dr-spinner--bar span { height:20px; }
.dr-spinner--bar span:nth-child(1){animation-delay:0s} .dr-spinner--bar span:nth-child(2){animation-delay:.1s}
.dr-spinner--bar span:nth-child(3){animation-delay:.2s} .dr-spinner--bar span:nth-child(4){animation-delay:.3s}
@keyframes dr-bar { 0%,100%{transform:scaleY(.4)} 50%{transform:scaleY(1)} }

/* ── Badge ────────────────────────────────────────────────────────── */
.dr-badge {
  display:inline-flex; align-items:center; gap:5px;
  padding:2px 9px; border-radius:9999px;
  font-family:var(--dr-font-family,system-ui); font-size:.72rem; font-weight:700; letter-spacing:.03em;
  white-space:nowrap;
}
.dr-badge--default   { background:rgba(255,255,255,.1);  color:var(--dr-color-text,#e2e8f0); }
.dr-badge--primary   { background:color-mix(in srgb,var(--dr-color-primary,#3b82f6) 18%,transparent); color:var(--dr-color-primary,#3b82f6); }
.dr-badge--secondary { background:rgba(99,102,241,.15);  color:#818cf8; }
.dr-badge--success   { background:rgba(16,185,129,.15);  color:#10b981; }
.dr-badge--warning   { background:rgba(245,158,11,.15);  color:#f59e0b; }
.dr-badge--danger    { background:rgba(244,63,94,.15);   color:#f43f5e; }
.dr-badge--info      { background:rgba(14,165,233,.15);  color:#0ea5e9; }
.dr-badge__dot { width:6px; height:6px; border-radius:50%; background:currentColor; animation:dr-badge-dot 2s ease infinite; }
@keyframes dr-badge-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
.dr-badge__remove { display:flex; align-items:center; background:transparent; border:none; color:inherit; opacity:.6; cursor:pointer; padding:0; margin-left:2px; }
.dr-badge__remove:hover { opacity:1; }
.dr-badge__remove svg { width:10px; height:10px; }

/* ── Avatar ───────────────────────────────────────────────────────── */
.dr-avatar { display:inline-flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden; position:relative; flex-shrink:0; border:2px solid var(--dr-color-surface,#0d0d1a); }
.dr-avatar--xs  { width:24px;  height:24px;  font-size:.6rem;  }
.dr-avatar--sm  { width:32px;  height:32px;  font-size:.7rem;  }
.dr-avatar--md  { width:40px;  height:40px;  font-size:.85rem; }
.dr-avatar--lg  { width:52px;  height:52px;  font-size:1rem;   }
.dr-avatar--xl  { width:64px;  height:64px;  font-size:1.2rem; }
.dr-avatar--2xl { width:80px;  height:80px;  font-size:1.5rem; }
.dr-avatar__img { width:100%; height:100%; object-fit:cover; }
.dr-avatar__initials { width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-family:var(--dr-font-family,system-ui); }
.dr-avatar__status { position:absolute; bottom:0; right:0; width:28%; height:28%; border-radius:50%; border:2px solid var(--dr-color-surface,#0d0d1a); }
.dr-avatar__status--online  { background:#10b981; }
.dr-avatar__status--offline { background:#64748b; }
.dr-avatar__status--away    { background:#f59e0b; }
.dr-avatar__status--busy    { background:#f43f5e; }
.dr-avatar--more { background:rgba(255,255,255,.1); color:var(--dr-color-text-muted,#64748b); font-size:.7rem; font-weight:700; font-family:var(--dr-font-family,system-ui); }
.dr-avatar-group { display:inline-flex; }
.dr-avatar-group .dr-avatar { margin-left:-8px; }
.dr-avatar-group .dr-avatar:first-child { margin-left:0; }
`;
  document.head.appendChild(s);
}
