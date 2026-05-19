import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAuditLog } from '../audit-log.js';
import type { AuditLog } from '../audit-log.js';

describe('createAuditLog', () => {
  let log: AuditLog;

  beforeEach(() => {
    log = createAuditLog();
  });

  // ── record ───────────────────────────────────────────────────────────

  it('record returns AuditEntry with correct fields', () => {
    const entry = log.record({
      signalName: 'user.name',
      action: 'write',
      previousValue: 'Alice',
      newValue: 'Bob',
      sessionId: 'sess-1',
      agentId: 'agent-1',
    });

    expect(entry.id).toBeTruthy();
    expect(typeof entry.timestamp).toBe('number');
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.signalName).toBe('user.name');
    expect(entry.action).toBe('write');
    expect(entry.previousValue).toBe('Alice');
    expect(entry.newValue).toBe('Bob');
    expect(entry.sessionId).toBe('sess-1');
    expect(entry.agentId).toBe('agent-1');
    expect(typeof entry.hash).toBe('string');
    expect(entry.hash.length).toBeGreaterThan(0);
  });

  it('record stores entry and getEntries returns it', () => {
    log.record({ signalName: 'counter', action: 'read' });
    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].signalName).toBe('counter');
  });

  it('record calls onEntry callback', () => {
    const onEntry = vi.fn();
    const l = createAuditLog({ onEntry });
    l.record({ signalName: 'x', action: 'write', newValue: 1 });
    expect(onEntry).toHaveBeenCalledTimes(1);
    expect(onEntry.mock.calls[0][0].signalName).toBe('x');
  });

  // ── getEntries ───────────────────────────────────────────────────────

  it('getEntries returns all entries when no filter given', () => {
    log.record({ signalName: 'a', action: 'read' });
    log.record({ signalName: 'b', action: 'write' });
    log.record({ signalName: 'c', action: 'watch' });
    expect(log.getEntries()).toHaveLength(3);
  });

  it('getEntries filters by signalName', () => {
    log.record({ signalName: 'alpha', action: 'read' });
    log.record({ signalName: 'beta', action: 'write' });
    log.record({ signalName: 'alpha', action: 'write' });
    const results = log.getEntries({ signalName: 'alpha' });
    expect(results).toHaveLength(2);
    expect(results.every(e => e.signalName === 'alpha')).toBe(true);
  });

  it('getEntries filters by action', () => {
    log.record({ signalName: 'x', action: 'read' });
    log.record({ signalName: 'y', action: 'write' });
    log.record({ signalName: 'z', action: 'watch' });
    const reads = log.getEntries({ action: 'read' });
    expect(reads).toHaveLength(1);
    expect(reads[0].signalName).toBe('x');
  });

  it('getEntries filters by sessionId', () => {
    log.record({ signalName: 'a', action: 'read', sessionId: 'sess-A' });
    log.record({ signalName: 'b', action: 'write', sessionId: 'sess-B' });
    const results = log.getEntries({ sessionId: 'sess-A' });
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe('sess-A');
  });

  it('getEntries filters by agentId', () => {
    log.record({ signalName: 'a', action: 'read', agentId: 'agent-X' });
    log.record({ signalName: 'b', action: 'write', agentId: 'agent-Y' });
    const results = log.getEntries({ agentId: 'agent-X' });
    expect(results).toHaveLength(1);
    expect(results[0].agentId).toBe('agent-X');
  });

  it('getEntries filters by from/to timestamp', () => {
    const now = Date.now();
    // Manually record with known timestamps by mocking Date.now
    const spy = vi.spyOn(Date, 'now');
    spy.mockReturnValueOnce(now - 200);
    log.record({ signalName: 'early', action: 'read' });
    spy.mockReturnValueOnce(now);
    log.record({ signalName: 'middle', action: 'read' });
    spy.mockReturnValueOnce(now + 200);
    log.record({ signalName: 'late', action: 'read' });
    spy.mockRestore();

    const results = log.getEntries({ from: now - 100, to: now + 100 });
    expect(results).toHaveLength(1);
    expect(results[0].signalName).toBe('middle');
  });

  // ── export ───────────────────────────────────────────────────────────

  it('export json returns valid JSON array', () => {
    log.record({ signalName: 'x', action: 'write', newValue: 42 });
    log.record({ signalName: 'y', action: 'read' });
    const out = log.export('json');
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].signalName).toBe('x');
  });

  it('export csv has correct headers as first line', () => {
    log.record({ signalName: 'mySignal', action: 'read', sessionId: 's1', agentId: 'a1' });
    const out = log.export('csv');
    const lines = out.split('\n');
    expect(lines[0]).toBe('id,timestamp,sessionId,agentId,signalName,action,hash');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('export csv data row contains expected values', () => {
    log.record({ signalName: 'mySignal', action: 'write', sessionId: 'sess-1', agentId: 'agent-1' });
    const out = log.export('csv');
    const lines = out.split('\n');
    // data row (index 1) should contain the signal name
    expect(lines[1]).toContain('mySignal');
    expect(lines[1]).toContain('write');
    expect(lines[1]).toContain('sess-1');
  });

  it('export splunk is valid NDJSON — one JSON object per line', () => {
    log.record({ signalName: 'a', action: 'read' });
    log.record({ signalName: 'b', action: 'write' });
    const out = log.export('splunk');
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(typeof parsed.id).toBe('string');
      expect(typeof parsed.signalName).toBe('string');
    }
  });

  it('export uses defaultFormat when no argument given', () => {
    const l = createAuditLog({ exportFormat: 'splunk' });
    l.record({ signalName: 'z', action: 'unwatch' });
    const out = l.export();
    // splunk: should be parseable as a single JSON object (one line)
    const parsed = JSON.parse(out.split('\n')[0]);
    expect(parsed.signalName).toBe('z');
  });

  // ── verify ───────────────────────────────────────────────────────────

  it('verify returns valid:true for untampered entries', () => {
    log.record({ signalName: 'x', action: 'write', newValue: 10 });
    log.record({ signalName: 'y', action: 'read' });
    const result = log.verify();
    expect(result.valid).toBe(true);
    expect(result.tamperedEntries).toHaveLength(0);
  });

  it('verify detects a tampered entry', () => {
    log.record({ signalName: 'x', action: 'write', newValue: 10 });
    // Directly mutate the internal entry (getEntries returns a shallow copy of the array
    // but objects are still references — we need to reach the actual entry)
    // Force tamper via the returned reference from record()
    const l = createAuditLog();
    const entry = l.record({ signalName: 'secret', action: 'write', newValue: 'original' });
    // Tamper: change the hash directly
    (entry as { hash: string }).hash = 'tampered-hash-value-00000000000000';
    // verify() re-reads from internal array; since `entry` IS the stored object (same ref),
    // the tamper will be detected
    const result = l.verify();
    expect(result.valid).toBe(false);
    expect(result.tamperedEntries).toContain(entry.id);
  });

  // ── redactPatterns ──────────────────────────────────────────────────

  it('redactPatterns redacts newValue and previousValue for matching signals', () => {
    const l = createAuditLog({ redactPatterns: ['user.password'] });
    const entry = l.record({
      signalName: 'user.password',
      action: 'write',
      previousValue: 'hunter2',
      newValue: 'newpass',
    });
    expect(entry.newValue).toBe('[REDACTED]');
    expect(entry.previousValue).toBe('[REDACTED]');
  });

  it('redactPatterns does not redact non-matching signals', () => {
    const l = createAuditLog({ redactPatterns: ['user.password'] });
    const entry = l.record({
      signalName: 'user.name',
      action: 'write',
      previousValue: 'Alice',
      newValue: 'Bob',
    });
    expect(entry.newValue).toBe('Bob');
    expect(entry.previousValue).toBe('Alice');
  });

  it('redactPatterns redacts sub-paths when pattern is a prefix', () => {
    const l = createAuditLog({ redactPatterns: ['user.password'] });
    const entry = l.record({
      signalName: 'user.password.confirm',
      action: 'write',
      newValue: 'secret',
    });
    expect(entry.newValue).toBe('[REDACTED]');
  });

  // ── getStats ─────────────────────────────────────────────────────────

  it('getStats returns correct totals, byAction, and bySignal', () => {
    log.record({ signalName: 'alpha', action: 'read' });
    log.record({ signalName: 'alpha', action: 'write' });
    log.record({ signalName: 'beta', action: 'read' });
    log.record({ signalName: 'beta', action: 'watch' });
    log.record({ signalName: 'gamma', action: 'unwatch' });

    const stats = log.getStats();
    expect(stats.total).toBe(5);
    expect(stats.byAction['read']).toBe(2);
    expect(stats.byAction['write']).toBe(1);
    expect(stats.byAction['watch']).toBe(1);
    expect(stats.byAction['unwatch']).toBe(1);
    expect(stats.bySignal['alpha']).toBe(2);
    expect(stats.bySignal['beta']).toBe(2);
    expect(stats.bySignal['gamma']).toBe(1);
  });

  // ── maxEntries ───────────────────────────────────────────────────────

  it('maxEntries trims oldest entries when limit exceeded', () => {
    const l = createAuditLog({ maxEntries: 3 });
    l.record({ signalName: 'first', action: 'read' });
    l.record({ signalName: 'second', action: 'read' });
    l.record({ signalName: 'third', action: 'read' });
    l.record({ signalName: 'fourth', action: 'read' });

    const entries = l.getEntries();
    expect(entries).toHaveLength(3);
    // Oldest ('first') should have been removed
    expect(entries.find(e => e.signalName === 'first')).toBeUndefined();
    expect(entries[entries.length - 1].signalName).toBe('fourth');
  });

  // ── clear ────────────────────────────────────────────────────────────

  it('clear empties all entries', () => {
    log.record({ signalName: 'x', action: 'read' });
    log.record({ signalName: 'y', action: 'write' });
    expect(log.getEntries()).toHaveLength(2);
    log.clear();
    expect(log.getEntries()).toHaveLength(0);
  });

  it('clear resets stats', () => {
    log.record({ signalName: 'x', action: 'read' });
    log.clear();
    const stats = log.getStats();
    expect(stats.total).toBe(0);
    expect(Object.keys(stats.byAction)).toHaveLength(0);
    expect(Object.keys(stats.bySignal)).toHaveLength(0);
  });
});
