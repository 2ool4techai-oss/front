import { describe, it, expect } from 'vitest';
import { createForm } from '../form.js';

describe('createForm', () => {
  const schema = {
    name:  { required: true, minLength: 2 },
    email: { required: true, email: true },
    age:   { min: 18, max: 99 },
  };

  it('initialises with empty values', () => {
    const form = createForm(schema);
    expect(form.fields.name.value()).toBe('');
    // valid is true before any validation runs (no errors shown yet)
    expect(form.state.valid()).toBe(true);
    expect(form.state.dirty()).toBe(false);
  });

  it('tracks dirty state', () => {
    const form = createForm(schema);
    expect(form.state.dirty()).toBe(false);
    form.fields.name.value.set('Alice');
    expect(form.state.dirty()).toBe(true);
  });

  it('validates required fields', () => {
    const form = createForm(schema);
    form.validateAll();
    expect(form.fields.name.error()).toBeTruthy();
    expect(form.fields.email.error()).toBeTruthy();
  });

  it('validates email format', () => {
    const form = createForm(schema);
    form.fields.email.value.set('not-an-email');
    form.fields.email.touched.set(true);
    expect(form.fields.email.error()).toBeTruthy();

    form.fields.email.value.set('valid@test.com');
    form.fields.email.touched.set(true);
    expect(form.fields.email.error()).toBeFalsy();
  });

  it('validates minLength', () => {
    const form = createForm(schema);
    form.fields.name.value.set('A');
    form.fields.name.touched.set(true);
    expect(form.fields.name.error()).toBeTruthy();

    form.fields.name.value.set('Alice');
    form.fields.name.touched.set(true);
    expect(form.fields.name.error()).toBeFalsy();
  });

  it('validates numeric min/max with custom validator', () => {
    const form = createForm({
      age: {
        validate: (v: string) => {
          const n = Number(v);
          if (isNaN(n)) return 'Must be a number';
          if (n < 18) return 'Must be at least 18';
          if (n > 99) return 'Must be at most 99';
          return null;
        },
      },
    });
    form.fields.age.value.set('16');
    form.fields.age.touched.set(true);
    expect(form.fields.age.error()).toBeTruthy();

    form.fields.age.value.set('25');
    form.fields.age.touched.set(true);
    expect(form.fields.age.error()).toBeFalsy();
  });

  it('reports valid when all fields pass', () => {
    const form = createForm(schema);
    form.setValues({ name: 'Alice', email: 'alice@example.com', age: '' });
    form.validateAll();
    expect(form.state.valid()).toBe(true);
  });

  it('reset() clears values and errors', () => {
    const form = createForm(schema);
    form.fields.name.value.set('Bob');
    form.validateAll();
    form.reset();
    expect(form.fields.name.value()).toBe('');
    expect(form.fields.name.error()).toBeFalsy();
    expect(form.state.dirty()).toBe(false);
  });

  it('supports custom validator', () => {
    const form = createForm({
      password: {
        type: 'text' as const,
        validate: (v: string) => v.length < 8 ? 'Too short' : null,
      },
    });
    form.fields.password.value.set('abc');
    form.fields.password.touched.set(true);
    expect(form.fields.password.error()).toBe('Too short');

    form.fields.password.value.set('strongpassword');
    form.fields.password.touched.set(true);
    expect(form.fields.password.error()).toBeNull();
  });

  it('submit() sets submitting state', async () => {
    const form = createForm(schema);
    form.setValues({ name: 'Alice', email: 'a@a.com', age: '25' });
    form.validateAll();

    let resolveSubmit!: () => void;
    const promise = new Promise<void>(r => { resolveSubmit = r; });
    const submitFn = form.submit(async () => { await promise; });

    submitFn();
    expect(form.state.submitting()).toBe(true);
    resolveSubmit();
    await promise;
    await Promise.resolve(); // allow .finally() microtask to run
    expect(form.state.submitting()).toBe(false);
    expect(form.state.submitted()).toBe(true);
  });
});
