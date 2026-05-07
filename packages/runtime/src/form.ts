import { signal, computed, batch } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Validation ─────────────────────────────────────────────────────────

export type Validator<T> = (value: T, allValues: Record<string, unknown>) => string | null | undefined;

export interface FieldSchema<T = string> {
  initial?:   T;
  required?:  boolean | string;     // true or custom message
  minLength?: number | [number, string];
  maxLength?: number | [number, string];
  min?:       number | [number, string];
  max?:       number | [number, string];
  pattern?:   RegExp | [RegExp, string];
  email?:     boolean | string;
  validate?:  Validator<T> | Validator<T>[];
}

export interface FieldState<T = string> {
  value:     Signal<T>;
  error:     Signal<string | null>;
  touched:   Signal<boolean>;
  dirty:     Signal<boolean>;
  valid:     ComputedSignal<boolean>;
}

export interface FormState {
  values:    ComputedSignal<Record<string, unknown>>;
  errors:    ComputedSignal<Record<string, string | null>>;
  valid:     ComputedSignal<boolean>;
  dirty:     ComputedSignal<boolean>;
  submitting:Signal<boolean>;
  submitted: Signal<boolean>;
}

export interface Form<T extends Record<string, FieldSchema>> {
  fields:  { [K in keyof T]: FieldState<InferFieldType<T[K]>> };
  state:   FormState;
  submit(handler: (values: InferValues<T>) => void | Promise<void>): (e?: Event) => void;
  reset(): void;
  setValues(values: Partial<InferValues<T>>): void;
  validateAll(): boolean;
}

// ── Type inference ─────────────────────────────────────────────────────

type InferFieldType<S> = S extends FieldSchema<infer T> ? T : string;
type InferValues<T extends Record<string, FieldSchema>> = {
  [K in keyof T]: InferFieldType<T[K]>
};

// ── createForm ─────────────────────────────────────────────────────────

export function createForm<T extends Record<string, FieldSchema>>(schema: T): Form<T> {
  type Values = InferValues<T>;

  // Build field states
  const fields = {} as { [K in keyof T]: FieldState<InferFieldType<T[K]>> };

  for (const key of Object.keys(schema) as (keyof T)[]) {
    const def = schema[key]!;
    const initial = (def.initial ?? '') as InferFieldType<typeof def>;

    const value   = signal(initial);
    const error   = signal<string | null>(null);
    const touched = signal(false);
    const dirty   = signal(false);
    const valid   = computed(() => error() === null);

    fields[key] = { value, error, touched, dirty, valid } as FieldState<InferFieldType<typeof def>>;
  }

  // Form-level computed state
  const values = computed(() => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) out[k] = fields[k as keyof T].value();
    return out;
  });

  const errors = computed(() => {
    const out: Record<string, string | null> = {};
    for (const k of Object.keys(fields)) out[k] = fields[k as keyof T].error();
    return out;
  });

  const valid = computed(() =>
    Object.keys(fields).every(k => fields[k as keyof T].valid())
  );

  const dirty = computed(() =>
    Object.keys(fields).some(k => fields[k as keyof T].dirty())
  );

  const submitting = signal(false);
  const submitted  = signal(false);

  // ── Validation ────────────────────────────────────────────────────────
  function validateField(key: keyof T): boolean {
    const def   = schema[key]!;
    const field = fields[key]!;
    const val   = field.value.peek() as unknown;
    const allVals = values.peek();

    let err: string | null = null;

    if (def.required && !val) {
      err = typeof def.required === 'string' ? def.required : 'This field is required';
    } else if (typeof val === 'string') {
      const [minLen, minMsg] = Array.isArray(def.minLength) ? def.minLength : [def.minLength, undefined];
      const [maxLen, maxMsg] = Array.isArray(def.maxLength) ? def.maxLength : [def.maxLength, undefined];
      const [pat,    patMsg] = Array.isArray(def.pattern)   ? def.pattern   : [def.pattern,   undefined];

      if (minLen !== undefined && val.length < minLen)
        err = minMsg ?? `Minimum ${minLen} characters`;
      else if (maxLen !== undefined && val.length > maxLen)
        err = maxMsg ?? `Maximum ${maxLen} characters`;
      else if (def.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
        err = typeof def.email === 'string' ? def.email : 'Invalid email address';
      else if (pat && !pat.test(val))
        err = patMsg ?? 'Invalid format';
    } else if (typeof val === 'number') {
      const [mn, mnMsg] = Array.isArray(def.min) ? def.min : [def.min, undefined];
      const [mx, mxMsg] = Array.isArray(def.max) ? def.max : [def.max, undefined];
      if (mn !== undefined && val < mn) err = mnMsg ?? `Minimum value is ${mn}`;
      else if (mx !== undefined && val > mx) err = mxMsg ?? `Maximum value is ${mx}`;
    }

    // Custom validators
    if (!err && def.validate) {
      const validators = Array.isArray(def.validate) ? def.validate : [def.validate];
      for (const v of validators) {
        const result = v(val as InferFieldType<typeof def>, allVals);
        if (result) { err = result; break; }
      }
    }

    field.error.set(err);
    return err === null;
  }

  function validateAll(): boolean {
    return Object.keys(schema).every(k => validateField(k as keyof T));
  }

  // Watch field values for live validation
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const field = fields[key]!;
    const initial = (schema[key]!.initial ?? '') as InferFieldType<typeof schema[keyof T]>;

    field.value.subscribe((v) => {
      field.dirty.set(!Object.is(v, initial));
      if (field.touched.peek()) validateField(key);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────
  const submit = (handler: (values: Values) => void | Promise<void>) => {
    return (e?: Event) => {
      e?.preventDefault();
      // Touch all fields
      for (const k of Object.keys(fields) as (keyof T)[]) {
        fields[k].touched.set(true);
      }
      if (!validateAll()) return;

      submitting.set(true);
      const result = handler(values.peek() as Values);
      if (result instanceof Promise) {
        result.finally(() => { submitting.set(false); submitted.set(true); });
      } else {
        submitting.set(false);
        submitted.set(true);
      }
    };
  };

  const reset = () => {
    batch(() => {
      for (const key of Object.keys(schema) as (keyof T)[]) {
        const def   = schema[key]!;
        const field = fields[key]!;
        field.value.set((def.initial ?? '') as InferFieldType<typeof def>);
        field.error.set(null);
        field.touched.set(false);
        field.dirty.set(false);
      }
      submitting.set(false);
      submitted.set(false);
    });
  };

  const setValues = (incoming: Partial<Values>) => {
    batch(() => {
      for (const [k, v] of Object.entries(incoming)) {
        if (k in fields) {
          (fields[k as keyof T] as FieldState).value.set(v as string);
        }
      }
    });
  };

  return {
    fields,
    state: { values, errors, valid, dirty, submitting, submitted },
    submit,
    reset,
    setValues,
    validateAll,
  };
}
