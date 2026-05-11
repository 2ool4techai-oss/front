import { describe, it, expect, beforeAll } from 'vitest';
import { signal, label, _enableDevMode } from '../signal.js';
import { createAuditLog } from '../audit.js';

beforeAll(() => { _enableDevMode(); });

describe('createAuditLog', () => {
  it('returns handle with empty log', () => {
    const audit = createAuditLog();
    expect(audit.log).toHaveLength(0);
    audit.stop();
  });

  it('signal writes captured in log', () => {
    const audit = createAuditLog();
    const s = signal(0);
    s.set(1);
    expect(audit.log.length).toBeGreaterThan(0);
    audit.stop();
  });

  it('log entry has correct signalLabel', () => {
    const audit = createAuditLog();
    const s = label(signal(0), 'myAuditSig');
    s.set(42);
    const entry = audit.log.find(e => e.signalLabel === 'myAuditSig');
    expect(entry).toBeDefined();
    audit.stop();
  });

  it('log entry has timestamp', () => {
    const audit = createAuditLog();
    const s = signal(0);
    const before = Date.now();
    s.set(99);
    const after = Date.now();
    const entry = audit.log[0];
    expect(entry).toBeDefined();
    expect(entry!.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry!.timestamp).toBeLessThanOrEqual(after);
    audit.stop();
  });

  it('log entry has prevValue and nextValue', () => {
    const audit = createAuditLog();
    const s = signal(10);
    s.set(20);
    const entry = audit.log.find(e => e.nextValue === 20);
    expect(entry).toBeDefined();
    expect(entry!.prevValue).toBe(10);
    audit.stop();
  });

  it('export() returns valid JSON string', () => {
    const audit = createAuditLog();
    const json = audit.export();
    expect(() => JSON.parse(json)).not.toThrow();
    audit.stop();
  });

  it('clear() empties log', () => {
    const audit = createAuditLog();
    const s = signal(0);
    s.set(1);
    audit.clear();
    expect(audit.log).toHaveLength(0);
    audit.stop();
  });

  it('getBySignal() filters by label', () => {
    const audit = createAuditLog();
    const s = label(signal(0), 'filteredSig');
    s.set(1);
    s.set(2);
    const entries = audit.getBySignal('filteredSig');
    expect(entries.length).toBeGreaterThanOrEqual(2);
    entries.forEach(e => expect(e.signalLabel).toBe('filteredSig'));
    audit.stop();
  });

  it('maxEntries cap enforced', () => {
    const audit = createAuditLog({ maxEntries: 3 });
    const s = signal(0);
    for (let i = 1; i <= 10; i++) s.set(i);
    expect(audit.log.length).toBeLessThanOrEqual(3);
    audit.stop();
  });

  it('stop() stops capturing new entries', () => {
    const audit = createAuditLog();
    const s = signal(0);
    s.set(1);
    const countBefore = audit.log.length;
    audit.stop();
    s.set(2);
    expect(audit.log.length).toBe(countBefore);
  });
});
