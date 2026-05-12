import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  privateSignal,
  isPrivateSignal,
  markAsPrivate,
  getPrivateSignals,
  clearPrivateAuditLog,
  getPrivateAuditLog,
} from '../private-signal.js';

beforeEach(() => {
  clearPrivateAuditLog();
});

describe('privateSignal', () => {
  it('returns real value on direct call ()', () => {
    const sig = privateSignal('alice@example.com', { category: 'email' });
    expect(sig()).toBe('alice@example.com');
  });

  it('set() updates the stored value', () => {
    const sig = privateSignal('old@example.com', { category: 'email' });
    sig.set('new@example.com');
    expect(sig()).toBe('new@example.com');
  });

  it('peek() returns raw value without audit log entry', () => {
    const sig = privateSignal('secret', { category: 'health', audit: true });
    clearPrivateAuditLog();
    const val = sig.peek();
    expect(val).toBe('secret');
    expect(getPrivateAuditLog()).toHaveLength(0);
  });

  it('redacted() returns default redaction string', () => {
    const sig = privateSignal('123-45-6789', { category: 'ssn' });
    expect(sig.redacted()).toBe('***REDACTED***');
  });

  it('redacted() uses custom redact function when provided', () => {
    const sig = privateSignal('John Doe', {
      category: 'name',
      redact: (v) => v[0] + '***',
    });
    expect(sig.redacted()).toBe('J***');
  });

  it('inContext() returns real value for allowed context', () => {
    const sig = privateSignal('555-1234', {
      category: 'phone',
      allowedContexts: ['admin-ui', 'support'],
    });
    expect(sig.inContext('admin-ui')).toBe('555-1234');
  });

  it('inContext() returns redacted for disallowed context', () => {
    const sig = privateSignal('555-1234', {
      category: 'phone',
      allowedContexts: ['admin-ui'],
    });
    expect(sig.inContext('llm-prompt')).toBe('***REDACTED***');
  });

  it('inContext() returns redacted when allowedContexts is empty', () => {
    const sig = privateSignal('sensitive', { category: 'health' });
    expect(sig.inContext('any-context')).toBe('***REDACTED***');
  });

  it('category property matches the provided category', () => {
    const sig = privateSignal(new Date('1990-01-01'), { category: 'dob' });
    expect(sig.category).toBe('dob');
  });

  it('isPrivateSignal() identifies private signals correctly', () => {
    const sig = privateSignal('data', { category: 'financial' });
    expect(isPrivateSignal(sig)).toBe(true);
  });

  it('isPrivateSignal() returns false for plain objects/functions', () => {
    expect(isPrivateSignal(() => 'hello')).toBe(false);
    expect(isPrivateSignal({ redacted: () => '***' })).toBe(false);
    expect(isPrivateSignal(null)).toBe(false);
    expect(isPrivateSignal(42)).toBe(false);
  });

  it('private signals are auto-registered in getPrivateSignals()', () => {
    const sig = privateSignal('address line 1', { category: 'address' });
    const allPrivate = getPrivateSignals();
    expect(allPrivate.has(sig as any)).toBe(true);
  });

  it('markAsPrivate() adds a signal to the private registry', () => {
    const sig = privateSignal('custom', { category: 'custom' });
    // Already registered, but calling markAsPrivate again should be idempotent
    markAsPrivate(sig as any);
    const allPrivate = getPrivateSignals();
    expect(allPrivate.has(sig as any)).toBe(true);
  });

  it('audit mode logs read and write actions', () => {
    const sig = privateSignal('secret@email.com', { category: 'email', audit: true });
    clearPrivateAuditLog();
    sig(); // read
    sig.set('new@email.com'); // write
    const log = getPrivateAuditLog();
    expect(log.some(e => e.action === 'read')).toBe(true);
    expect(log.some(e => e.action === 'write')).toBe(true);
    expect(log.every(e => e.category === 'email')).toBe(true);
  });

  it('audit mode logs redacted-read when .redacted() is called', () => {
    const sig = privateSignal('private', { category: 'health', audit: true });
    clearPrivateAuditLog();
    sig.redacted();
    const log = getPrivateAuditLog();
    expect(log.some(e => e.action === 'redacted-read')).toBe(true);
  });

  it('audit mode logs context-read and context-denied', () => {
    const sig = privateSignal('data', {
      category: 'financial',
      allowedContexts: ['trusted'],
      audit: true,
    });
    clearPrivateAuditLog();
    sig.inContext('trusted');
    sig.inContext('untrusted');
    const log = getPrivateAuditLog();
    expect(log.some(e => e.action === 'context-read' && e.context === 'trusted')).toBe(true);
    expect(log.some(e => e.action === 'context-denied' && e.context === 'untrusted')).toBe(true);
  });
});
