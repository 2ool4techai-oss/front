export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content:    string | HTMLElement;
  placement?: TooltipPlacement;
  delay?:     number;   // ms before showing (default 400)
  maxWidth?:  number;
}

injectTooltipStyles();

// Attach a tooltip to any element — returns a cleanup fn.
export function attachTooltip(target: HTMLElement, props: TooltipProps): () => void {
  const placement = props.placement ?? 'top';
  const delay     = props.delay     ?? 400;

  let tipEl:    HTMLElement | null = null;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function show(): void {
    hideTimer && clearTimeout(hideTimer);
    showTimer = setTimeout(() => {
      if (tipEl) return;
      tipEl = document.createElement('div');
      tipEl.className = `dr-tooltip dr-tooltip--${placement}`;
      tipEl.setAttribute('role', 'tooltip');
      if (props.maxWidth) tipEl.style.maxWidth = `${props.maxWidth}px`;

      if (typeof props.content === 'string') {
        tipEl.textContent = props.content;
      } else {
        tipEl.appendChild(props.content.cloneNode(true));
      }

      document.body.appendChild(tipEl);
      position();

      requestAnimationFrame(() => tipEl?.classList.add('dr-tooltip--visible'));
    }, delay);
  }

  function hide(): void {
    showTimer && clearTimeout(showTimer);
    hideTimer = setTimeout(() => {
      if (!tipEl) return;
      tipEl.classList.remove('dr-tooltip--visible');
      tipEl.addEventListener('transitionend', () => {
        tipEl?.remove();
        tipEl = null;
      }, { once: true });
    }, 100);
  }

  function position(): void {
    if (!tipEl) return;
    const tr  = target.getBoundingClientRect();
    const tt  = tipEl.getBoundingClientRect();
    const gap = 8;
    let top = 0, left = 0;

    switch (placement) {
      case 'top':
        top  = tr.top  - tt.height - gap + window.scrollY;
        left = tr.left + (tr.width - tt.width) / 2 + window.scrollX;
        break;
      case 'bottom':
        top  = tr.bottom + gap + window.scrollY;
        left = tr.left + (tr.width - tt.width) / 2 + window.scrollX;
        break;
      case 'left':
        top  = tr.top + (tr.height - tt.height) / 2 + window.scrollY;
        left = tr.left - tt.width - gap + window.scrollX;
        break;
      case 'right':
        top  = tr.top + (tr.height - tt.height) / 2 + window.scrollY;
        left = tr.right + gap + window.scrollX;
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tt.width - 8));
    top  = Math.max(8, top);

    tipEl.style.top  = `${top}px`;
    tipEl.style.left = `${left}px`;
  }

  target.addEventListener('mouseenter', show);
  target.addEventListener('mouseleave', hide);
  target.addEventListener('focus',      show);
  target.addEventListener('blur',       hide);

  return () => {
    showTimer && clearTimeout(showTimer);
    hideTimer && clearTimeout(hideTimer);
    tipEl?.remove();
    target.removeEventListener('mouseenter', show);
    target.removeEventListener('mouseleave', hide);
    target.removeEventListener('focus',      show);
    target.removeEventListener('blur',       hide);
  };
}

// Convenience: wraps an element in a tooltip container
export function withTooltip(el: HTMLElement, props: TooltipProps): HTMLElement {
  attachTooltip(el, props);
  return el;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectTooltipStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'tooltip';
  s.textContent = `
.dr-tooltip {
  position:absolute; z-index:9000; pointer-events:none;
  padding:5px 10px; border-radius:6px;
  background:rgba(10,10,20,.95); color:var(--dr-color-text,#e2e8f0);
  font-family:var(--dr-font-family,system-ui); font-size:.78rem; line-height:1.5;
  border:1px solid rgba(255,255,255,.1);
  box-shadow:0 4px 16px rgba(0,0,0,.4);
  max-width:220px;
  opacity:0; transform:scale(.94);
  transition: opacity calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.4) ease,
              transform calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.4) cubic-bezier(.34,1.56,.64,1);
}
.dr-tooltip--visible { opacity:1; transform:scale(1); }
`;
  document.head.appendChild(s);
}
