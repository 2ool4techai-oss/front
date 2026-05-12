import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAITrace, globalTrace } from '../aitrace.js';

beforeEach(() => {
  globalTrace.clear();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

describe('createAITrace', () => {
  it('starts with no entries', () => {
    const t = createAITrace();
    expect(t.entries()).toHaveLength(0);
  });

  it('records an entry and assigns id + timestamp', () => {
    const t = createAITrace();
    const before = Date.now();
    t.record({ actor: 'ai', action: 'write', target: 'counter' });
    const after = Date.now();
    const entries = t.entries();
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.id).toMatch(/^trace_/);
    expect(e.timestamp).toBeGreaterThanOrEqual(before);
    expect(e.timestamp).toBeLessThanOrEqual(after);
    expect(e.actor).toBe('ai');
    expect(e.action).toBe('write');
    expect(e.target).toBe('counter');
  });

  it('records all optional fields', () => {
    const t = createAITrace();
    t.record({
      actor: 'human',
      action: 'read',
      target: 'form.email',
      before: 'old@example.com',
      after: 'new@example.com',
      reason: 'user edited field',
      confidence: 0.95,
      approved: true,
      agentId: 'agent-007',
    });
    const e = t.entries()[0];
    expect(e.before).toBe('old@example.com');
    expect(e.after).toBe('new@example.com');
    expect(e.reason).toBe('user edited field');
    expect(e.confidence).toBe(0.95);
    expect(e.approved).toBe(true);
    expect(e.agentId).toBe('agent-007');
  });

  it('assigns unique ids to each entry', () => {
    const t = createAITrace();
    t.record({ actor: 'ai', action: 'generate', target: 'headline' });
    t.record({ actor: 'ai', action: 'generate', target: 'headline' });
    const [e1, e2] = t.entries();
    expect(e1.id).not.toBe(e2.id);
  });

  it('clear() empties the trace', () => {
    const t = createAITrace();
    t.record({ actor: 'system', action: 'heal', target: 'layout' });
    expect(t.entries()).toHaveLength(1);
    t.clear();
    expect(t.entries()).toHaveLength(0);
  });

  it('export() returns valid JSON string', () => {
    const t = createAITrace();
    t.record({ actor: 'ai', action: 'query', target: 'db' });
    const json = t.export();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].target).toBe('db');
  });

  it('filter() returns matching entries', () => {
    const t = createAITrace();
    t.record({ actor: 'ai',     action: 'write',    target: 'title' });
    t.record({ actor: 'human',  action: 'read',     target: 'form' });
    t.record({ actor: 'system', action: 'heal',     target: 'nav' });
    t.record({ actor: 'ai',     action: 'generate', target: 'bio' });

    const aiEntries = t.filter((e) => e.actor === 'ai');
    expect(aiEntries).toHaveLength(2);
    expect(aiEntries.every((e) => e.actor === 'ai')).toBe(true);
  });

  it('subscribe() fires when a new entry is recorded', () => {
    const t = createAITrace();
    const spy = vi.fn();
    t.subscribe(spy);

    t.record({ actor: 'ai', action: 'write', target: 'x' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].target).toBe('x');
  });

  it('subscribe() unsubscribe stops notifications', () => {
    const t = createAITrace();
    const spy = vi.fn();
    const unsub = t.subscribe(spy);
    unsub();
    t.record({ actor: 'ai', action: 'write', target: 'y' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('respects maxEntries option and trims oldest entries', () => {
    const t = createAITrace({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      t.record({ actor: 'ai', action: 'write', target: `sig_${i}` });
    }
    const entries = t.entries();
    expect(entries).toHaveLength(3);
    // Oldest entries were dropped — most recent three remain
    expect(entries[entries.length - 1].target).toBe('sig_4');
  });

  it('persist option saves to localStorage', () => {
    const t = createAITrace({ persist: true });
    t.record({ actor: 'ai', action: 'generate', target: 'content' });
    const raw = localStorage.getItem('__drishti_aitrace__');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed[0].target).toBe('content');
  });

  it('persist option loads previous entries on creation', () => {
    const t1 = createAITrace({ persist: true });
    t1.record({ actor: 'human', action: 'read', target: 'profile' });

    // Create a new trace with persist — should load from localStorage
    const t2 = createAITrace({ persist: true });
    expect(t2.entries()).toHaveLength(1);
    expect(t2.entries()[0].target).toBe('profile');
  });
});

describe('globalTrace', () => {
  it('is a shared AITrace instance', () => {
    globalTrace.record({ actor: 'system', action: 'query', target: 'global-test' });
    expect(globalTrace.entries().some((e) => e.target === 'global-test')).toBe(true);
  });
});
