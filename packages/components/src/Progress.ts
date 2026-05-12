import { effect } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

export type ProgressVariant = 'default' | 'success' | 'warning' | 'danger';
export type ProgressSize    = 'xs' | 'sm' | 'md' | 'lg';

export interface ProgressProps {
  value:       number | Signal<number>;  // 0–100
  max?:        number;
  label?:      string;
  showValue?:  boolean;
  variant?:    ProgressVariant;
  size?:       ProgressSize;
  animated?:   boolean;   // striped animation
  indeterminate?: boolean;
  class?:      string;
}

export interface CircularProgressProps {
  value:      number | Signal<number>;  // 0–100
  size?:      number;    // px, default 48
  stroke?:    number;    // stroke width, default 4
  label?:     string | Signal<string>;
  variant?:   ProgressVariant;
  class?:     string;
}

injectProgressStyles();

// ── Linear Progress ────────────────────────────────────────────────────
export function Progress(props: ProgressProps): HTMLDivElement {
  const variant  = props.variant ?? 'default';
  const size     = props.size    ?? 'md';
  const max      = props.max     ?? 100;

  const root = document.createElement('div');
  root.className = `dr-progress-wrap${props.class ? ` ${props.class}` : ''}`;

  if (props.label || props.showValue) {
    const header = document.createElement('div');
    header.className = 'dr-progress-header';
    if (props.label) {
      const lbl = document.createElement('span');
      lbl.className = 'dr-progress-label';
      lbl.textContent = props.label;
      header.appendChild(lbl);
    }
    if (props.showValue) {
      const val = document.createElement('span');
      val.className = 'dr-progress-value';
      if (typeof props.value === 'function') {
        effect(() => { val.textContent = `${Math.round((props.value as Signal<number>)())}%`; });
      } else {
        val.textContent = `${Math.round(props.value)}%`;
      }
      header.appendChild(val);
    }
    root.appendChild(header);
  }

  const track = document.createElement('div');
  track.className = `dr-progress dr-progress--${variant} dr-progress--${size}`;
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(max));

  const bar = document.createElement('div');
  bar.className = `dr-progress__bar${props.animated ? ' dr-progress__bar--animated' : ''}${props.indeterminate ? ' dr-progress__bar--indeterminate' : ''}`;

  const setVal = (v: number): void => {
    const pct = Math.max(0, Math.min(100, (v / max) * 100));
    bar.style.width = `${pct}%`;
    track.setAttribute('aria-valuenow', String(v));
  };

  if (typeof props.value === 'function') {
    effect(() => setVal((props.value as Signal<number>)()));
  } else {
    setVal(props.value);
  }

  track.appendChild(bar);
  root.appendChild(track);
  return root;
}

// ── Circular Progress ──────────────────────────────────────────────────
export function CircularProgress(props: CircularProgressProps): SVGSVGElement {
  const size    = props.size   ?? 48;
  const stroke  = props.stroke ?? 4;
  const variant = props.variant ?? 'default';
  const r       = (size - stroke) / 2;
  const circ    = 2 * Math.PI * r;
  const cx      = size / 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width',  String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('role', 'progressbar');
  svg.setAttribute('aria-valuemin', '0');
  svg.setAttribute('aria-valuemax', '100');
  if (props.class) svg.setAttribute('class', `dr-circular-progress dr-circular-progress--${variant} ${props.class}`);
  else svg.setAttribute('class', `dr-circular-progress dr-circular-progress--${variant}`);

  // Track circle
  const trackCirc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  trackCirc.setAttribute('cx', String(cx)); trackCirc.setAttribute('cy', String(cx));
  trackCirc.setAttribute('r',  String(r));
  trackCirc.setAttribute('fill', 'none');
  trackCirc.setAttribute('stroke', 'rgba(255,255,255,.1)');
  trackCirc.setAttribute('stroke-width', String(stroke));
  svg.appendChild(trackCirc);

  // Progress circle
  const progCirc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progCirc.setAttribute('cx', String(cx)); progCirc.setAttribute('cy', String(cx));
  progCirc.setAttribute('r',  String(r));
  progCirc.setAttribute('fill', 'none');
  progCirc.setAttribute('stroke-width', String(stroke));
  progCirc.setAttribute('stroke-linecap', 'round');
  progCirc.setAttribute('stroke-dasharray', String(circ));
  progCirc.style.transformOrigin = '50% 50%';
  progCirc.style.transform       = 'rotate(-90deg)';
  progCirc.style.transition      = `stroke-dashoffset calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)) ease`;
  svg.appendChild(progCirc);

  // Label text
  if (props.label !== undefined) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '50%'); text.setAttribute('y', '50%');
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-family', 'var(--dr-font-family,system-ui)');
    text.setAttribute('font-size',   String(Math.floor(size * 0.22)));
    text.setAttribute('font-weight', '700');
    text.setAttribute('fill', 'var(--dr-color-text,#e2e8f0)');
    if (typeof props.label === 'function') {
      effect(() => { text.textContent = (props.label as Signal<string>)(); });
    } else {
      text.textContent = props.label;
    }
    svg.appendChild(text);
  }

  const COLORS: Record<ProgressVariant, string> = {
    default: 'var(--dr-color-primary,#3b82f6)',
    success: '#10b981', warning: '#f59e0b', danger: '#f43f5e',
  };
  progCirc.setAttribute('stroke', COLORS[variant]);

  const setVal = (v: number): void => {
    const pct = Math.max(0, Math.min(100, v));
    progCirc.setAttribute('stroke-dashoffset', String(circ * (1 - pct / 100)));
    svg.setAttribute('aria-valuenow', String(v));
  };

  if (typeof props.value === 'function') {
    effect(() => setVal((props.value as Signal<number>)()));
  } else {
    setVal(props.value);
  }

  return svg;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectProgressStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'progress';
  s.textContent = `
.dr-progress-wrap { display:flex; flex-direction:column; gap:6px; width:100%; }
.dr-progress-header { display:flex; justify-content:space-between; align-items:center; }
.dr-progress-label { font-family:var(--dr-font-family,system-ui); font-size:.8rem; font-weight:600; color:var(--dr-color-text,#e2e8f0); }
.dr-progress-value { font-family:var(--dr-font-family,system-ui); font-size:.75rem; color:var(--dr-color-text-muted,#64748b); }
.dr-progress { background:rgba(255,255,255,.08); border-radius:9999px; overflow:hidden; }
.dr-progress--xs { height:3px; }  .dr-progress--sm { height:5px; }
.dr-progress--md { height:8px; }  .dr-progress--lg { height:12px; }
.dr-progress__bar {
  height:100%; border-radius:9999px; width:0%;
  transition: width calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)) ease;
}
.dr-progress--default .dr-progress__bar { background:var(--dr-color-primary,#3b82f6); }
.dr-progress--success .dr-progress__bar { background:#10b981; }
.dr-progress--warning .dr-progress__bar { background:#f59e0b; }
.dr-progress--danger  .dr-progress__bar { background:#f43f5e; }
.dr-progress__bar--animated { background-image:linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%); background-size:1rem 1rem; animation:dr-progress-stripe 1s linear infinite; }
@keyframes dr-progress-stripe { from{background-position:1rem 0} to{background-position:0 0} }
.dr-progress__bar--indeterminate { width:40% !important; animation:dr-progress-indeterminate calc(1.2s*var(--dr-adapt-speed,1)) ease infinite; }
@keyframes dr-progress-indeterminate { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
`;
  document.head.appendChild(s);
}
