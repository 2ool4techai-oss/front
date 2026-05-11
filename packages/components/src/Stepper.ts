// ── Stepper / Wizard component ─────────────────────────────────────────

import { signal, computed } from '@drishti/runtime';
import type { Signal, ComputedSignal } from '@drishti/runtime';

export interface StepConfig {
  label:        string;
  description?: string;
  content:      HTMLElement | (() => HTMLElement);
  validate?:    () => boolean | string;
}

export interface StepperOptions {
  steps:         StepConfig[];
  initialStep?:  number;
  linear?:       boolean;
  onComplete?:   () => void;
  onStepChange?: (from: number, to: number) => void;
}

export interface StepperHandle {
  readonly currentStep: Signal<number>;
  readonly completed:   Signal<boolean>;
  next():     boolean;
  prev():     void;
  goTo(n: number): void;
  reset():    void;
  destroy():  void;
  mount(container: HTMLElement): void;
}

// ── Style injection ────────────────────────────────────────────────────

function injectStepperStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-stepper-styles')) return;
  const s = document.createElement('style');
  s.id = 'dr-stepper-styles';
  s.textContent = `
.dr-stepper { font-family: var(--dr-font-family, system-ui, sans-serif); }
.dr-stepper__indicator {
  display: flex; align-items: center; margin-bottom: 24px;
}
.dr-stepper__step {
  display: flex; flex-direction: column; align-items: center; flex: 1;
  position: relative;
}
.dr-stepper__step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 16px; left: 50%;
  width: 100%; height: 2px;
  background: var(--dr-color-border, rgba(255,255,255,.15));
  z-index: 0;
}
.dr-stepper__step--completed::after {
  background: var(--dr-color-primary, #3b82f6);
}
.dr-stepper__circle {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--dr-color-border, rgba(255,255,255,.15));
  color: var(--dr-color-text-muted, #64748b);
  font-size: .875rem; font-weight: 700;
  position: relative; z-index: 1;
  transition: background 200ms, color 200ms;
  border: 2px solid transparent;
}
.dr-stepper__step--active .dr-stepper__circle {
  background: var(--dr-color-primary, #3b82f6);
  color: #fff;
  border-color: var(--dr-color-primary, #3b82f6);
}
.dr-stepper__step--completed .dr-stepper__circle {
  background: var(--dr-color-primary, #3b82f6);
  color: #fff;
}
.dr-stepper__label {
  margin-top: 6px;
  font-size: .75rem;
  color: var(--dr-color-text-muted, #64748b);
  text-align: center;
}
.dr-stepper__step--active .dr-stepper__label { color: var(--dr-color-text, #e2e8f0); font-weight: 600; }
.dr-stepper__content { min-height: 80px; margin-bottom: 20px; }
.dr-stepper__footer { display: flex; gap: 8px; }
.dr-stepper__btn {
  padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer;
  font-family: var(--dr-font-family, system-ui); font-size: .875rem; font-weight: 600;
  transition: background 150ms;
}
.dr-stepper__btn--primary {
  background: var(--dr-color-primary, #3b82f6); color: #fff;
}
.dr-stepper__btn--primary:hover { filter: brightness(1.1); }
.dr-stepper__btn--secondary {
  background: rgba(255,255,255,.08); color: var(--dr-color-text, #e2e8f0);
}
.dr-stepper__btn--secondary:hover { background: rgba(255,255,255,.14); }
.dr-stepper__error {
  color: var(--dr-color-danger, #ef4444);
  font-size: .8rem; margin-top: 8px;
}
`;
  document.head.appendChild(s);
}

// ── createStepper ──────────────────────────────────────────────────────

export function createStepper(opts: StepperOptions): StepperHandle {
  if (typeof document !== 'undefined') injectStepperStyles();

  const linear = opts.linear ?? true;
  const steps  = opts.steps;
  const initialStep = opts.initialStep ?? 0;

  const currentStepSig  = signal(initialStep);
  const completedSig    = signal(false);
  // Track which steps have been completed
  const completedSteps  = new Set<number>();

  let root: HTMLElement | null = null;
  let errorEl: HTMLElement | null = null;

  function renderContent(stepIdx: number): HTMLElement {
    const step = steps[stepIdx];
    if (!step) return document.createElement('div');
    return typeof step.content === 'function' ? step.content() : step.content;
  }

  function updateUI(): void {
    if (!root) return;
    const current = currentStepSig.peek();

    // Update step indicators
    const circles = root.querySelectorAll<HTMLElement>('.dr-stepper__step');
    circles.forEach((stepEl, i) => {
      stepEl.classList.remove('dr-stepper__step--active', 'dr-stepper__step--completed');
      if (i === current) stepEl.classList.add('dr-stepper__step--active');
      else if (completedSteps.has(i) || i < current) {
        stepEl.classList.add('dr-stepper__step--completed');
        const circle = stepEl.querySelector<HTMLElement>('.dr-stepper__circle');
        if (circle) circle.textContent = '✓';
      } else {
        const circle = stepEl.querySelector<HTMLElement>('.dr-stepper__circle');
        if (circle) circle.textContent = String(i + 1);
      }
    });

    // Update content area
    const contentArea = root.querySelector<HTMLElement>('.dr-stepper__content');
    if (contentArea) {
      contentArea.innerHTML = '';
      contentArea.appendChild(renderContent(current));
    }

    // Clear error
    if (errorEl) errorEl.textContent = '';

    // Update nav buttons
    const prevBtn = root.querySelector<HTMLButtonElement>('.dr-stepper__btn--prev');
    const nextBtn = root.querySelector<HTMLButtonElement>('.dr-stepper__btn--next');
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) {
      if (current === steps.length - 1) {
        nextBtn.textContent = 'Finish';
      } else {
        nextBtn.textContent = 'Next';
      }
    }
  }

  const handle: StepperHandle = {
    get currentStep() { return currentStepSig; },
    get completed()   { return completedSig; },

    next(): boolean {
      const current = currentStepSig.peek();
      const step = steps[current];
      if (step?.validate) {
        const result = step.validate();
        if (result !== true) {
          // Show error
          if (errorEl) {
            errorEl.textContent = typeof result === 'string' ? result : 'Validation failed';
          }
          return false;
        }
      }
      completedSteps.add(current);

      if (current >= steps.length - 1) {
        completedSig.set(true);
        opts.onComplete?.();
        return true;
      }

      const next = current + 1;
      opts.onStepChange?.(current, next);
      currentStepSig.set(next);
      updateUI();
      return true;
    },

    prev(): void {
      const current = currentStepSig.peek();
      if (current <= 0) return;
      const prev = current - 1;
      opts.onStepChange?.(current, prev);
      currentStepSig.set(prev);
      updateUI();
    },

    goTo(n: number): void {
      if (n < 0 || n >= steps.length) return;
      if (linear) {
        const current = currentStepSig.peek();
        // Can only go to completed steps or current+1
        if (n !== current + 1 && !completedSteps.has(n) && n !== current) return;
      }
      const current = currentStepSig.peek();
      opts.onStepChange?.(current, n);
      currentStepSig.set(n);
      updateUI();
    },

    reset(): void {
      completedSteps.clear();
      completedSig.set(false);
      const current = currentStepSig.peek();
      opts.onStepChange?.(current, 0);
      currentStepSig.set(0);
      updateUI();
    },

    destroy(): void {
      if (root) {
        root.remove();
        root = null;
      }
    },

    mount(container: HTMLElement): void {
      if (typeof document !== 'undefined') injectStepperStyles();
      root = document.createElement('div');
      root.className = 'dr-stepper';

      // ── Indicator bar ─────────────────────────────────────────────────
      const indicator = document.createElement('div');
      indicator.className = 'dr-stepper__indicator';

      steps.forEach((step, i) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'dr-stepper__step';
        if (i === currentStepSig.peek()) stepEl.classList.add('dr-stepper__step--active');

        const circle = document.createElement('div');
        circle.className = 'dr-stepper__circle';
        circle.textContent = String(i + 1);
        stepEl.appendChild(circle);

        const label = document.createElement('div');
        label.className = 'dr-stepper__label';
        label.textContent = step.label;
        stepEl.appendChild(label);

        indicator.appendChild(stepEl);
      });

      root.appendChild(indicator);

      // ── Content area ──────────────────────────────────────────────────
      const contentArea = document.createElement('div');
      contentArea.className = 'dr-stepper__content';
      contentArea.appendChild(renderContent(currentStepSig.peek()));
      root.appendChild(contentArea);

      // ── Error message ─────────────────────────────────────────────────
      errorEl = document.createElement('div');
      errorEl.className = 'dr-stepper__error';
      root.appendChild(errorEl);

      // ── Navigation ────────────────────────────────────────────────────
      const footer = document.createElement('div');
      footer.className = 'dr-stepper__footer';

      const prevBtn = document.createElement('button');
      prevBtn.className = 'dr-stepper__btn dr-stepper__btn--secondary dr-stepper__btn--prev';
      prevBtn.textContent = 'Back';
      prevBtn.disabled = currentStepSig.peek() === 0;
      prevBtn.addEventListener('click', () => handle.prev());
      footer.appendChild(prevBtn);

      const nextBtn = document.createElement('button');
      nextBtn.className = 'dr-stepper__btn dr-stepper__btn--primary dr-stepper__btn--next';
      nextBtn.textContent = currentStepSig.peek() === steps.length - 1 ? 'Finish' : 'Next';
      nextBtn.addEventListener('click', () => handle.next());
      footer.appendChild(nextBtn);

      root.appendChild(footer);
      container.appendChild(root);
    },
  };

  return handle;
}
