import type { Signal } from '@drishti/runtime';
import { signal } from '@drishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface SliderOptions {
  min?:      number;
  max?:      number;
  step?:     number;
  value?:    number;
  range?:    boolean;
  valueB?:   number;
  disabled?: boolean;
  label?:    string;
  showValue?: boolean;
  onChange?: (value: number, valueB?: number) => void;
  size?:     'sm' | 'md' | 'lg';
}

export interface SliderHandle {
  readonly value:  Signal<number>;
  readonly valueB: Signal<number | undefined>;
  setValue(v: number): void;
  setValueB(v: number): void;
  destroy(): void;
  mount(container: HTMLElement): void;
}

// ── Styles ─────────────────────────────────────────────────────────────

function injectSliderStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-slider-styles')) return;
  const style = document.createElement('style');
  style.id = 'dr-slider-styles';
  style.textContent = `
.dr-slider{position:relative;display:inline-flex;flex-direction:column;gap:4px;width:100%;min-width:120px;user-select:none}
.dr-slider__label{font-size:13px;color:#374151}
.dr-slider__value{font-size:12px;color:#6b7280;text-align:right}
.dr-slider-track{position:relative;height:6px;border-radius:3px;background:#e5e7eb;cursor:pointer}
.dr-slider--sm .dr-slider-track{height:4px}
.dr-slider--lg .dr-slider-track{height:8px}
.dr-slider-fill{position:absolute;top:0;left:0;height:100%;border-radius:3px;background:#2563eb;pointer-events:none}
.dr-slider--disabled .dr-slider-fill{background:#9ca3af}
.dr-slider-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #2563eb;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:box-shadow .1s;z-index:1}
.dr-slider--sm .dr-slider-thumb{width:12px;height:12px}
.dr-slider--lg .dr-slider-thumb{width:20px;height:20px}
.dr-slider-thumb:active{cursor:grabbing;box-shadow:0 0 0 4px rgba(37,99,235,.2)}
.dr-slider--disabled .dr-slider-thumb{border-color:#9ca3af;cursor:not-allowed}
.dr-slider--disabled{opacity:.6}
`;
  document.head.appendChild(style);
}

// ── Helpers ────────────────────────────────────────────────────────────

function clampSnap(v: number, min: number, max: number, step: number): number {
  const snapped = Math.round((v - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
}

// ── createSlider ───────────────────────────────────────────────────────

export function createSlider(opts?: SliderOptions): SliderHandle {
  injectSliderStyles();

  const min   = opts?.min   ?? 0;
  const max   = opts?.max   ?? 100;
  const step  = opts?.step  ?? 1;
  const range = opts?.range ?? false;

  const initialValue = clampSnap(opts?.value ?? min, min, max, step);
  const initialValueB = range
    ? clampSnap(opts?.valueB ?? max, min, max, step)
    : undefined;

  const value  = signal<number>(initialValue);
  const valueB = signal<number | undefined>(initialValueB);

  let container:  HTMLElement | null = null;
  let wrapEl:     HTMLElement | null = null;
  let trackEl:    HTMLElement | null = null;
  let fillEl:     HTMLElement | null = null;
  let thumbEl:    HTMLElement | null = null;
  let thumbBEl:   HTMLElement | null = null;
  let valueLabel: HTMLElement | null = null;
  let draggingThumb: HTMLElement | null = null;
  const cleanups: Array<() => void> = [];

  function getPercent(v: number): number {
    return ((v - min) / (max - min)) * 100;
  }

  function updateFill(): void {
    if (!fillEl || !thumbEl) return;
    if (range && thumbBEl) {
      const pA = getPercent(value());
      const pB = getPercent(valueB() ?? max);
      fillEl.style.left  = `${Math.min(pA, pB)}%`;
      fillEl.style.width = `${Math.abs(pB - pA)}%`;
      thumbBEl.style.left = `${pB}%`;
    } else {
      const p = getPercent(value());
      fillEl.style.left  = '0%';
      fillEl.style.width = `${p}%`;
    }
    thumbEl.style.left = `${getPercent(value())}%`;
    thumbEl.setAttribute('aria-valuenow', String(value()));
    if (valueLabel) {
      if (range) {
        valueLabel.textContent = `${value()} – ${valueB() ?? max}`;
      } else {
        valueLabel.textContent = String(value());
      }
    }
  }

  function valueFromPointer(e: PointerEvent): number {
    if (!trackEl) return min;
    const rect = trackEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return clampSnap(min + ratio * (max - min), min, max, step);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!draggingThumb || opts?.disabled) return;
    const v = valueFromPointer(e);
    if (draggingThumb === thumbBEl) {
      const vA = value();
      const clamped = Math.max(vA, v);
      valueB.set(clamped);
      opts?.onChange?.(vA, clamped);
    } else {
      const vB = valueB();
      const clamped = vB !== undefined ? Math.min(v, vB) : v;
      value.set(clamped);
      opts?.onChange?.(clamped, vB);
    }
    updateFill();
  }

  function onPointerUp(): void {
    if (draggingThumb) {
      draggingThumb.releasePointerCapture((draggingThumb as any)._pointerId ?? 0);
    }
    draggingThumb = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }

  function attachThumbEvents(thumb: HTMLElement, isB: boolean): void {
    thumb.addEventListener('pointerdown', (e: PointerEvent) => {
      if (opts?.disabled) return;
      e.preventDefault();
      draggingThumb = thumb;
      (thumb as any)._pointerId = e.pointerId;
      thumb.setPointerCapture(e.pointerId);
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });

    thumb.addEventListener('keydown', (e: KeyboardEvent) => {
      if (opts?.disabled) return;
      let v = isB ? (valueB() ?? max) : value();
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        v = clampSnap(v + step, min, max, step);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        v = clampSnap(v - step, min, max, step);
      } else {
        return;
      }
      if (isB) {
        const vA = value();
        valueB.set(Math.max(vA, v));
        opts?.onChange?.(vA, Math.max(vA, v));
      } else {
        const vB = valueB();
        value.set(vB !== undefined ? Math.min(v, vB) : v);
        opts?.onChange?.(value(), vB);
      }
      updateFill();
    });
  }

  function setValue(v: number): void {
    const clamped = clampSnap(v, min, max, step);
    const vB = valueB();
    value.set(vB !== undefined ? Math.min(clamped, vB) : clamped);
    updateFill();
  }

  function setValueB(v: number): void {
    const clamped = clampSnap(v, min, max, step);
    valueB.set(Math.max(value(), clamped));
    updateFill();
  }

  function mount(el: HTMLElement): void {
    container = el;
    injectSliderStyles();

    wrapEl = document.createElement('div');
    wrapEl.className = `dr-slider dr-slider--${opts?.size ?? 'md'}${opts?.disabled ? ' dr-slider--disabled' : ''}`;

    if (opts?.label) {
      const lbl = document.createElement('div');
      lbl.className = 'dr-slider__label';
      lbl.textContent = opts.label;
      wrapEl.appendChild(lbl);
    }

    trackEl = document.createElement('div');
    trackEl.className = 'dr-slider-track';

    fillEl = document.createElement('div');
    fillEl.className = 'dr-slider-fill';
    trackEl.appendChild(fillEl);

    thumbEl = document.createElement('div');
    thumbEl.className = 'dr-slider-thumb';
    thumbEl.setAttribute('role', 'slider');
    thumbEl.setAttribute('tabindex', opts?.disabled ? '-1' : '0');
    thumbEl.setAttribute('aria-valuemin', String(min));
    thumbEl.setAttribute('aria-valuemax', String(max));
    thumbEl.setAttribute('aria-valuenow', String(value()));
    if (opts?.label) thumbEl.setAttribute('aria-label', opts.label);
    trackEl.appendChild(thumbEl);
    attachThumbEvents(thumbEl, false);

    if (range) {
      thumbBEl = document.createElement('div');
      thumbBEl.className = 'dr-slider-thumb';
      thumbBEl.setAttribute('role', 'slider');
      thumbBEl.setAttribute('tabindex', opts?.disabled ? '-1' : '0');
      thumbBEl.setAttribute('aria-valuemin', String(min));
      thumbBEl.setAttribute('aria-valuemax', String(max));
      thumbBEl.setAttribute('aria-valuenow', String(valueB() ?? max));
      if (opts?.label) thumbBEl.setAttribute('aria-label', `${opts.label} end`);
      trackEl.appendChild(thumbBEl);
      attachThumbEvents(thumbBEl, true);
    }

    wrapEl.appendChild(trackEl);

    if (opts?.showValue) {
      valueLabel = document.createElement('div');
      valueLabel.className = 'dr-slider__value';
      wrapEl.appendChild(valueLabel);
    }

    // Track click to set value
    trackEl.addEventListener('click', (e: MouseEvent) => {
      if (opts?.disabled || draggingThumb) return;
      const v = valueFromPointer(e as unknown as PointerEvent);
      if (range) {
        const vA = value();
        const vB2 = valueB() ?? max;
        const midpoint = (vA + vB2) / 2;
        if (v <= midpoint) {
          value.set(Math.min(v, vB2));
          opts?.onChange?.(Math.min(v, vB2), vB2);
        } else {
          valueB.set(Math.max(v, vA));
          opts?.onChange?.(vA, Math.max(v, vA));
        }
      } else {
        value.set(v);
        opts?.onChange?.(v);
      }
      updateFill();
    });

    el.appendChild(wrapEl);
    updateFill();

    cleanups.push(() => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    });
  }

  function destroy(): void {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
    if (wrapEl && container) {
      container.removeChild(wrapEl);
    }
    wrapEl    = null;
    container = null;
  }

  return { value, valueB, setValue, setValueB, destroy, mount };
}
