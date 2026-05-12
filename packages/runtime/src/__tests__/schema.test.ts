import { describe, it, expect, beforeEach } from 'vitest';
import { captureScreenSchema, registerSchemaSignal, restoreFromSchema, schemaToPrompt, _clearSchemaRegistry } from '../schema.js';
import { signal } from '../signal.js';

beforeEach(() => {
  _clearSchemaRegistry();
});

describe('captureScreenSchema', () => {
  it('returns a ScreenSchema with version and timestamp', () => {
    const schema = captureScreenSchema();
    expect(schema.version).toBeDefined();
    expect(typeof schema.timestamp).toBe('number');
    expect(Array.isArray(schema.signals)).toBe(true);
  });

  it('includes registered signals', () => {
    const s = signal(42);
    registerSchemaSignal(s, 'counter', 'Counter');
    const schema = captureScreenSchema();
    const entry = schema.signals.find(e => e.id === 'counter');
    expect(entry).toBeDefined();
    expect(entry!.value).toBe(42);
  });

  it('reflects current signal values', () => {
    const s = signal('initial');
    registerSchemaSignal(s, 'text', 'Text');
    s.set('updated');
    const schema = captureScreenSchema();
    const entry = schema.signals.find(e => e.id === 'text');
    expect(entry!.value).toBe('updated');
  });
});

describe('restoreFromSchema', () => {
  it('restores signal values from schema', () => {
    const s = signal(0);
    registerSchemaSignal(s, 'myVal', 'My Value');
    const schema = captureScreenSchema();
    s.set(999);
    restoreFromSchema(schema);
    expect(s()).toBe(0);
  });
});

describe('schemaToPrompt', () => {
  it('returns a non-empty string describing state', () => {
    const s = signal('hello');
    registerSchemaSignal(s, 'greeting', 'Greeting');
    const schema = captureScreenSchema();
    const prompt = schemaToPrompt(schema);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});
