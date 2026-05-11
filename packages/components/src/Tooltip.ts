// ── Tooltip and Popover components ────────────────────────────────────
// Position-aware tooltip with collision detection, arrow, and multiple triggers.

export type TooltipPlacement =
  | 'top' | 'bottom' | 'left' | 'right'
  | 'top-start' | 'top-end'
  | 'bottom-start' | 'bottom-end';

export interface TooltipOptions {
  content:    string | HTMLElement;
  placement?: TooltipPlacement;   // default 'top'
  trigger?:   'hover' | 'focus' | 'click' | 'manual';  // default 'hover'
  delay?:     number;             // show delay ms, default 200
  hideDelay?: number;             // hide delay ms, default 100
  arrow?:     boolean;            // default true
  maxWidth?:  number;             // default 240
  offset?:    number;             // distance from target, default 8
}

export interface TooltipHandle {
  show(): void;
  hide(): void;
  destroy(): void;
}

export interface PopoverOptions extends TooltipOptions {
  title?:       string;
  closable?:    boolean;
  interactive?: boolean;  // don't close when hovering content
}

// ── Style injection ────────────────────────────────────────────────────

function injectTooltipStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-tooltip-styles')) return;
  const s = document.createElement('style');
  s.id = 'dr-tooltip-styles';
  s.textContent = `
.dr-tooltip, .dr-popover {
  position: absolute;
  z-index: 9000;
  pointer-events: none;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(10,10,20,.95);
  color: var(--dr-color-text, #e2e8f0);
  font-family: var(--dr-font-family, system-ui);
  font-size: .78rem;
  line-height: 1.5;
  border: 1px solid rgba(255,255,255,.1);
  box-shadow: 0 4px 16px rgba(0,0,0,.4);
  max-width: 240px;
  opacity: 0;
  transition: opacity 120ms ease, transform 120ms cubic-bezier(.34,1.56,.64,1);
  word-wrap: break-word;
}
.dr-tooltip--visible, .dr-popover--visible {
  opacity: 1;
}
.dr-tooltip__arrow, .dr-popover__arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: rgba(10,10,20,.95);
  border: 1px solid rgba(255,255,255,.1);
  transform: rotate(45deg);
}
/* Arrow positioning handled inline */
.dr-popover {
  pointer-events: all;
  padding: 0;
  min-width: 180px;
  font-size: .85rem;
}
.dr-popover__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px 8px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.dr-popover__title {
  font-weight: 700; font-size: .875rem;
  color: var(--dr-color-text, #e2e8f0); margin: 0;
}
.dr-popover__close {
  background: transparent; border: none;
  color: rgba(255,255,255,.4); font-size: 1rem; line-height: 1;
  cursor: pointer; padding: 0; width: 18px; text-align: center;
}
.dr-popover__close:hover { color: rgba(255,255,255,.8); }
.dr-popover__body {
  padding: 10px 14px 12px;
  color: rgba(255,255,255,.75);
}
`;
  document.head.appendChild(s);
}

// ── Positioning ────────────────────────────────────────────────────────

type BaseAxis = 'top' | 'bottom' | 'left' | 'right';

function getBaseAxis(placement: TooltipPlacement): BaseAxis {
  if (placement.startsWith('top')) return 'top';
  if (placement.startsWith('bottom')) return 'bottom';
  if (placement.startsWith('left')) return 'left';
  return 'right';
}

function positionElement(
  tipEl: HTMLElement,
  arrowEl: HTMLElement | null,
  target: HTMLElement,
  placement: TooltipPlacement,
  offset: number,
): void {
  const tr  = target.getBoundingClientRect();
  const tt  = tipEl.getBoundingClientRect();
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const gap = offset;

  let axis = getBaseAxis(placement);
  let align: 'start' | 'end' | 'center' = 'center';
  if (placement.endsWith('-start')) align = 'start';
  else if (placement.endsWith('-end')) align = 'end';

  // Collision detection: flip axis if overflow
  if (axis === 'top'    && tr.top    - tt.height - gap < 0)          axis = 'bottom';
  else if (axis === 'bottom' && tr.bottom + tt.height + gap > vh)    axis = 'top';
  else if (axis === 'left'   && tr.left   - tt.width  - gap < 0)     axis = 'right';
  else if (axis === 'right'  && tr.right  + tt.width  + gap > vw)    axis = 'left';

  let top = 0, left = 0;

  switch (axis) {
    case 'top':
      top = tr.top - tt.height - gap + window.scrollY;
      if (align === 'center') left = tr.left + (tr.width - tt.width) / 2 + window.scrollX;
      else if (align === 'start') left = tr.left + window.scrollX;
      else left = tr.right - tt.width + window.scrollX;
      break;
    case 'bottom':
      top = tr.bottom + gap + window.scrollY;
      if (align === 'center') left = tr.left + (tr.width - tt.width) / 2 + window.scrollX;
      else if (align === 'start') left = tr.left + window.scrollX;
      else left = tr.right - tt.width + window.scrollX;
      break;
    case 'left':
      left = tr.left - tt.width - gap + window.scrollX;
      top  = tr.top + (tr.height - tt.height) / 2 + window.scrollY;
      break;
    case 'right':
      left = tr.right + gap + window.scrollX;
      top  = tr.top + (tr.height - tt.height) / 2 + window.scrollY;
      break;
  }

  // Clamp to viewport
  left = Math.max(8, Math.min(left, vw - tt.width - 8 + window.scrollX));
  top  = Math.max(8, top);

  tipEl.style.top  = `${top}px`;
  tipEl.style.left = `${left}px`;

  // Arrow positioning
  if (arrowEl) {
    arrowEl.style.cssText = '';
    const aw = 8;
    switch (axis) {
      case 'top':
        arrowEl.style.bottom = `-${aw / 2 + 1}px`;
        arrowEl.style.left = `${tt.width / 2 - aw / 2}px`;
        arrowEl.style.borderTop = 'none';
        arrowEl.style.borderLeft = 'none';
        break;
      case 'bottom':
        arrowEl.style.top = `-${aw / 2 + 1}px`;
        arrowEl.style.left = `${tt.width / 2 - aw / 2}px`;
        arrowEl.style.borderBottom = 'none';
        arrowEl.style.borderRight = 'none';
        break;
      case 'left':
        arrowEl.style.right = `-${aw / 2 + 1}px`;
        arrowEl.style.top = `${tt.height / 2 - aw / 2}px`;
        arrowEl.style.borderTop = 'none';
        arrowEl.style.borderRight = 'none';
        break;
      case 'right':
        arrowEl.style.left = `-${aw / 2 + 1}px`;
        arrowEl.style.top = `${tt.height / 2 - aw / 2}px`;
        arrowEl.style.borderBottom = 'none';
        arrowEl.style.borderLeft = 'none';
        break;
    }
  }
}

// ── createTooltip ──────────────────────────────────────────────────────

export function createTooltip(target: HTMLElement, opts: TooltipOptions): TooltipHandle {
  injectTooltipStyles();

  const placement = opts.placement ?? 'top';
  const trigger   = opts.trigger   ?? 'hover';
  const delay     = opts.delay     ?? 200;
  const hideDelay = opts.hideDelay ?? 100;
  const showArrow = opts.arrow     ?? true;
  const maxWidth  = opts.maxWidth  ?? 240;
  const offset    = opts.offset    ?? 8;

  let tipEl:     HTMLElement | null = null;
  let arrowEl:   HTMLElement | null = null;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  // Generate a unique id for aria-describedby
  const tooltipId = `dr-tooltip-${Math.random().toString(36).slice(2, 8)}`;

  function buildTip(): void {
    tipEl = document.createElement('div');
    tipEl.id        = tooltipId;
    tipEl.className = 'dr-tooltip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.style.maxWidth = `${maxWidth}px`;

    if (typeof opts.content === 'string') {
      tipEl.textContent = opts.content;
    } else {
      tipEl.appendChild(opts.content.cloneNode(true));
    }

    if (showArrow) {
      arrowEl = document.createElement('div');
      arrowEl.className = 'dr-tooltip__arrow';
      tipEl.appendChild(arrowEl);
    }

    document.body.appendChild(tipEl);
    target.setAttribute('aria-describedby', tooltipId);
    positionElement(tipEl, arrowEl, target, placement, offset);
  }

  function doShow(): void {
    if (tipEl) return;
    buildTip();
    requestAnimationFrame(() => tipEl?.classList.add('dr-tooltip--visible'));
  }

  function doHide(): void {
    if (!tipEl) return;
    tipEl.classList.remove('dr-tooltip--visible');
    const el = tipEl;
    tipEl = null;
    arrowEl = null;
    target.removeAttribute('aria-describedby');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 200);
  }

  const handle: TooltipHandle = {
    show(): void {
      if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
      showTimer = setTimeout(doShow, delay);
    },
    hide(): void {
      if (showTimer !== null) { clearTimeout(showTimer); showTimer = null; }
      hideTimer = setTimeout(doHide, hideDelay);
    },
    destroy(): void {
      if (showTimer !== null) clearTimeout(showTimer);
      if (hideTimer !== null) clearTimeout(hideTimer);
      doHide();
      target.removeEventListener('mouseenter', onMouseEnter);
      target.removeEventListener('mouseleave', onMouseLeave);
      target.removeEventListener('focus', onFocus);
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('click', onClick);
      document.removeEventListener('click', onDocClick);
    },
  };

  // ── Event listeners ────────────────────────────────────────────────

  function onMouseEnter() { handle.show(); }
  function onMouseLeave() { handle.hide(); }
  function onFocus()      { handle.show(); }
  function onBlur()       { handle.hide(); }
  function onClick(e: Event) {
    e.stopPropagation();
    if (tipEl) { handle.hide(); } else { handle.show(); }
  }
  function onDocClick() { handle.hide(); }

  if (trigger === 'hover') {
    target.addEventListener('mouseenter', onMouseEnter);
    target.addEventListener('mouseleave', onMouseLeave);
  } else if (trigger === 'focus') {
    target.addEventListener('focus', onFocus);
    target.addEventListener('blur', onBlur);
  } else if (trigger === 'click') {
    target.addEventListener('click', onClick);
    document.addEventListener('click', onDocClick);
  }
  // 'manual': no listeners

  return handle;
}

// ── createPopover ──────────────────────────────────────────────────────

export function createPopover(target: HTMLElement, opts: PopoverOptions): TooltipHandle {
  injectTooltipStyles();

  const placement   = opts.placement   ?? 'bottom';
  const trigger     = opts.trigger     ?? 'click';
  const delay       = opts.delay       ?? 200;
  const hideDelay   = opts.hideDelay   ?? 100;
  const showArrow   = opts.arrow       ?? true;
  const maxWidth    = opts.maxWidth    ?? 240;
  const offset      = opts.offset      ?? 8;
  const interactive = opts.interactive ?? false;

  let tipEl:     HTMLElement | null = null;
  let arrowEl:   HTMLElement | null = null;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const tooltipId = `dr-popover-${Math.random().toString(36).slice(2, 8)}`;

  function buildPopover(): void {
    tipEl = document.createElement('div');
    tipEl.id        = tooltipId;
    tipEl.className = 'dr-popover';
    tipEl.style.maxWidth = `${maxWidth}px`;

    if (opts.title || opts.closable) {
      const header = document.createElement('div');
      header.className = 'dr-popover__header';

      if (opts.title) {
        const titleEl = document.createElement('strong');
        titleEl.className = 'dr-popover__title';
        titleEl.textContent = opts.title;
        header.appendChild(titleEl);
      }

      if (opts.closable) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dr-popover__close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => handle.hide());
        header.appendChild(closeBtn);
      }

      tipEl.appendChild(header);
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'dr-popover__body';

    if (typeof opts.content === 'string') {
      bodyEl.textContent = opts.content;
    } else {
      bodyEl.appendChild(opts.content.cloneNode(true));
    }

    tipEl.appendChild(bodyEl);

    if (showArrow) {
      arrowEl = document.createElement('div');
      arrowEl.className = 'dr-popover__arrow';
      tipEl.appendChild(arrowEl);
    }

    document.body.appendChild(tipEl);
    target.setAttribute('aria-describedby', tooltipId);
    positionElement(tipEl, arrowEl, target, placement, offset);

    if (interactive) {
      tipEl.addEventListener('mouseenter', () => {
        if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
      });
      tipEl.addEventListener('mouseleave', () => {
        handle.hide();
      });
    }
  }

  function doShow(): void {
    if (tipEl) return;
    buildPopover();
    requestAnimationFrame(() => tipEl?.classList.add('dr-popover--visible'));
  }

  function doHide(): void {
    if (!tipEl) return;
    tipEl.classList.remove('dr-popover--visible');
    const el = tipEl;
    tipEl = null;
    arrowEl = null;
    target.removeAttribute('aria-describedby');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 200);
  }

  const handle: TooltipHandle = {
    show(): void {
      if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
      showTimer = setTimeout(doShow, delay);
    },
    hide(): void {
      if (showTimer !== null) { clearTimeout(showTimer); showTimer = null; }
      hideTimer = setTimeout(doHide, hideDelay);
    },
    destroy(): void {
      if (showTimer !== null) clearTimeout(showTimer);
      if (hideTimer !== null) clearTimeout(hideTimer);
      doHide();
      target.removeEventListener('mouseenter', onMouseEnter);
      target.removeEventListener('mouseleave', onMouseLeave);
      target.removeEventListener('focus', onFocus);
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('click', onClickToggle);
      document.removeEventListener('click', onDocClick);
    },
  };

  function onMouseEnter() { handle.show(); }
  function onMouseLeave() { handle.hide(); }
  function onFocus()      { handle.show(); }
  function onBlur()       { handle.hide(); }
  function onClickToggle(e: Event) {
    e.stopPropagation();
    if (tipEl) { handle.hide(); } else { handle.show(); }
  }
  function onDocClick() { handle.hide(); }

  if (trigger === 'hover') {
    target.addEventListener('mouseenter', onMouseEnter);
    target.addEventListener('mouseleave', onMouseLeave);
  } else if (trigger === 'focus') {
    target.addEventListener('focus', onFocus);
    target.addEventListener('blur', onBlur);
  } else if (trigger === 'click') {
    target.addEventListener('click', onClickToggle);
    document.addEventListener('click', onDocClick);
  }
  // 'manual': no listeners

  return handle;
}
