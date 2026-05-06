import { signal, effect, h } from '@drishti/runtime';
import { sanitizeInput } from '@drishti/runtime';
import type { EmotionState } from '@drishti/runtime';

export interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'password' | 'textarea';
  placeholder?: string;
  required?: boolean;
  validate?: (v: string) => string | null;
}

export interface SentientFormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, string>) => Promise<void> | void;
  submitLabel?: string;
  emotion?: () => EmotionState;
}

export function SentientForm(props: SentientFormProps): HTMLElement {
  const values = new Map(props.fields.map(f => [f.name, signal('')]));
  const errors = new Map(props.fields.map(f => [f.name, signal<string | null>(null)]));
  const submitting = signal(false);
  const submitted = signal(false);
  const globalError = signal<string | null>(null);

  const form = h('form', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'calc(var(--dr-spacing-unit, 8px) * 2)',
      fontFamily: 'var(--dr-font-family, system-ui)',
    },
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting.peek()) return;

    let valid = true;
    const data: Record<string, string> = {};

    for (const field of props.fields) {
      const val = values.get(field.name)!.peek();
      const sanitized = sanitizeInput(val);
      data[field.name] = sanitized;

      if (field.required && !sanitized.trim()) {
        errors.get(field.name)!.set(`${field.label} is required`);
        valid = false;
      } else if (field.validate) {
        const err = field.validate(sanitized);
        errors.get(field.name)!.set(err);
        if (err) valid = false;
      } else {
        errors.get(field.name)!.set(null);
      }
    }

    if (!valid) return;

    submitting.set(true);
    globalError.set(null);
    try {
      await props.onSubmit(data);
      submitted.set(true);
    } catch (err) {
      globalError.set(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      submitting.set(false);
    }
  });

  for (const field of props.fields) {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });

    const labelEl = document.createElement('label');
    labelEl.textContent = field.label + (field.required ? ' *' : '');
    labelEl.style.cssText = 'font-size:.875rem;font-weight:500;color:#374151;';

    const inputEl = field.type === 'textarea'
      ? document.createElement('textarea')
      : document.createElement('input');

    if (inputEl instanceof HTMLInputElement) inputEl.type = field.type ?? 'text';

    inputEl.placeholder = field.placeholder ?? '';
    inputEl.style.cssText = `
      padding: 8px 12px;
      border: 1.5px solid #d1d5db;
      border-radius: var(--dr-border-radius, 6px);
      font-size: var(--dr-font-size-base, 1rem);
      font-family: inherit;
      outline: none;
      transition: border-color var(--dr-transition-speed, 200ms);
      width: 100%;
      box-sizing: border-box;
    `;

    inputEl.addEventListener('input', () => {
      values.get(field.name)!.set((inputEl as HTMLInputElement).value);
      errors.get(field.name)!.set(null);
    });

    inputEl.addEventListener('focus', () => { inputEl.style.borderColor = 'var(--dr-color-primary, #2D6BE4)'; });
    inputEl.addEventListener('blur', () => { inputEl.style.borderColor = '#d1d5db'; });

    const errorEl = h('span', { style: { fontSize: '.75rem', color: '#ef4444', minHeight: '1em' } });

    effect(() => {
      const err = errors.get(field.name)!();
      errorEl.textContent = err ?? '';
      inputEl.style.borderColor = err ? '#ef4444' : '#d1d5db';
    });

    wrap.appendChild(labelEl);
    wrap.appendChild(inputEl);
    wrap.appendChild(errorEl);
    form.appendChild(wrap);
  }

  const globalErrorEl = h('div', {
    style: {
      display: 'none',
      padding: '10px 14px',
      background: '#fff8f8',
      border: '1px solid #ffcdd2',
      borderRadius: 'var(--dr-border-radius, 6px)',
      color: '#c62828',
      fontSize: '.875rem',
    },
  });

  effect(() => {
    const err = globalError();
    globalErrorEl.style.display = err ? 'block' : 'none';
    globalErrorEl.textContent = err ?? '';
  });

  const submitBtn = h('button', {
    type: 'submit',
    style: {
      padding: '10px 24px',
      background: 'var(--dr-color-primary, #2D6BE4)',
      color: '#fff',
      border: 'none',
      borderRadius: 'var(--dr-border-radius, 6px)',
      fontSize: 'var(--dr-font-size-base, 1rem)',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'opacity var(--dr-transition-speed, 200ms), transform var(--dr-transition-speed, 200ms)',
      fontFamily: 'inherit',
    },
  });

  const successEl = h('div', {
    style: {
      display: 'none',
      padding: '12px 16px',
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: 'var(--dr-border-radius, 6px)',
      color: '#15803d',
      fontSize: '.875rem',
      fontWeight: '500',
    },
  });
  successEl.textContent = '✓ Submitted successfully';

  effect(() => {
    const s = submitting();
    const done = submitted();
    submitBtn.textContent = s ? 'Submitting…' : (props.submitLabel ?? 'Submit');
    submitBtn.style.opacity = s ? '0.7' : '1';
    (submitBtn as HTMLButtonElement).disabled = s;
    successEl.style.display = done ? 'block' : 'none';
    submitBtn.style.display = done ? 'none' : 'block';
  });

  if (props.emotion) {
    effect(() => {
      const e = props.emotion!();
      if (e === 'confused' || e === 'frustrated') {
        form.querySelectorAll('label').forEach(l => {
          l.style.fontWeight = '700';
          l.style.fontSize = '1rem';
        });
      }
    });
  }

  form.appendChild(globalErrorEl);
  form.appendChild(submitBtn);
  form.appendChild(successEl);

  return form;
}
