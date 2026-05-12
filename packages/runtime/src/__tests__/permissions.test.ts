import { describe, it, expect, beforeEach } from 'vitest';
import { withPermissions, getAuditLog, clearAuditLog, setAIAgent, getAIAgent, PermissionError } from '../permissions.js';
import { signal } from '../signal.js';

beforeEach(() => {
  clearAuditLog();
  setAIAgent(null);
});

describe('withPermissions', () => {
  it('read-write access allows both reads and writes', () => {
    const s = signal(10);
    const p = withPermissions(s, { aiAccess: 'read-write' });
    expect(p()).toBe(10);
    p.set(20);
    expect(p()).toBe(20);
  });

  it('read-only blocks writes for AI agent', () => {
    const s = signal(5);
    const p = withPermissions(s, { aiAccess: 'read-only' });
    setAIAgent('agent-1');
    expect(p()).toBe(5);
    expect(() => p.set(99)).toThrow(PermissionError);
  });

  it('none blocks reads for AI agent', () => {
    const s = signal('secret');
    const p = withPermissions(s, { aiAccess: 'none' });
    setAIAgent('agent-1');
    expect(() => p()).toThrow(PermissionError);
  });

  it('write-only blocks reads for AI agent', () => {
    const s = signal(0);
    const p = withPermissions(s, { aiAccess: 'write-only' });
    setAIAgent('agent-1');
    expect(() => p()).toThrow(PermissionError);
    p.set(42); // write should work
    expect(s()).toBe(42);
  });

  it('canRead and canWrite reflect permissions', () => {
    const s = signal(1);
    const p = withPermissions(s, { aiAccess: 'read-only' });
    expect(p.canRead()).toBe(true);
    expect(p.canWrite()).toBe(true); // human can still write by default
  });

  it('peek bypasses read permission check', () => {
    const s = signal(7);
    const p = withPermissions(s, { aiAccess: 'none' });
    setAIAgent('agent-1');
    // peek should not throw even for 'none'
    expect(p.peek()).toBe(7);
  });

  it('audit:true logs reads', () => {
    const s = signal('hello');
    const p = withPermissions(s, { audit: true });
    p();
    const log = getAuditLog();
    expect(log.some(e => e.type === 'read')).toBe(true);
  });

  it('audit:true logs writes', () => {
    const s = signal(0);
    const p = withPermissions(s, { audit: true });
    p.set(5);
    const log = getAuditLog();
    expect(log.some(e => e.type === 'write')).toBe(true);
  });

  it('clearAuditLog empties the log', () => {
    const s = signal(0);
    const p = withPermissions(s, { audit: true });
    p();
    expect(getAuditLog().length).toBeGreaterThan(0);
    clearAuditLog();
    expect(getAuditLog()).toHaveLength(0);
  });

  it('setAIAgent / getAIAgent tracks current agent', () => {
    setAIAgent('my-agent');
    expect(getAIAgent()).toBe('my-agent');
    setAIAgent(null);
    expect(getAIAgent()).toBeNull();
  });

  it('permissions property is accessible', () => {
    const s = signal(1);
    const p = withPermissions(s, { aiAccess: 'read-only', audit: true });
    expect(p.permissions.aiAccess).toBe('read-only');
    expect(p.permissions.audit).toBe(true);
  });
});
