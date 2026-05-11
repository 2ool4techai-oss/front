import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStepper } from '../Stepper.js';

function makeSteps(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    label: `Step ${i + 1}`,
    content: (() => {
      const el = document.createElement('div');
      el.textContent = `Content ${i + 1}`;
      el.className = `step-${i}`;
      return el;
    })(),
  }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createStepper', () => {
  it('mounts with first step visible', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const stepper = createStepper({ steps: makeSteps() });
    stepper.mount(container);
    expect(container.querySelector('.dr-stepper')).not.toBeNull();
    expect(container.textContent).toContain('Content 1');
  });

  it('currentStep starts at 0', () => {
    const stepper = createStepper({ steps: makeSteps() });
    expect(stepper.currentStep()).toBe(0);
  });

  it('next() advances step', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const stepper = createStepper({ steps: makeSteps() });
    stepper.mount(container);
    const result = stepper.next();
    expect(result).toBe(true);
    expect(stepper.currentStep()).toBe(1);
  });

  it('prev() goes back', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const stepper = createStepper({ steps: makeSteps() });
    stepper.mount(container);
    stepper.next();
    expect(stepper.currentStep()).toBe(1);
    stepper.prev();
    expect(stepper.currentStep()).toBe(0);
  });

  it('completed signal true at last step after next()', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const steps = makeSteps(2);
    const stepper = createStepper({ steps });
    stepper.mount(container);
    expect(stepper.completed()).toBe(false);
    stepper.next(); // go to step 1
    stepper.next(); // finish
    expect(stepper.completed()).toBe(true);
  });

  it('validate() returning string blocks next()', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const steps = [
      {
        label: 'Step 1',
        content: document.createElement('div'),
        validate: () => 'Please fill out this field',
      },
      {
        label: 'Step 2',
        content: document.createElement('div'),
      },
    ];
    const stepper = createStepper({ steps });
    stepper.mount(container);
    const result = stepper.next();
    expect(result).toBe(false);
    expect(stepper.currentStep()).toBe(0);
    // Error should be displayed
    expect(container.textContent).toContain('Please fill out this field');
  });

  it('reset() returns to step 0', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const stepper = createStepper({ steps: makeSteps() });
    stepper.mount(container);
    stepper.next();
    expect(stepper.currentStep()).toBe(1);
    stepper.reset();
    expect(stepper.currentStep()).toBe(0);
  });

  it('onStepChange callback fires', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onStepChange = vi.fn();
    const stepper = createStepper({ steps: makeSteps(), onStepChange });
    stepper.mount(container);
    stepper.next();
    expect(onStepChange).toHaveBeenCalledWith(0, 1);
  });
});
