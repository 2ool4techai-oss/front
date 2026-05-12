import { describe, it, expect, vi } from 'vitest';
import { detectCycles, guardedComputed, CircularDependencyError } from '../circular-guard.js';
import { signal } from '../signal.js';

describe('detectCycles — pure graph utility', () => {
  it('returns empty array for empty graph', () => {
    const graph = new Map<string, string[]>();
    expect(detectCycles(graph)).toHaveLength(0);
  });

  it('returns empty array for acyclic graph', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]);
    expect(detectCycles(graph)).toHaveLength(0);
  });

  it('detects a self-loop', () => {
    const graph = new Map([['a', ['a']]]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain('a');
  });

  it('detects a two-node cycle', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('detects a three-node cycle', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
    const flat = cycles.flat();
    expect(flat).toContain('a');
    expect(flat).toContain('b');
    expect(flat).toContain('c');
  });

  it('returns empty for disconnected acyclic subgraphs', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', []],
      ['x', ['y']],
      ['y', []],
    ]);
    expect(detectCycles(graph)).toHaveLength(0);
  });
});

describe('guardedComputed — safe usage', () => {
  it('creates a computed with no deps and no cycle', () => {
    const gc = guardedComputed('doubled', () => 2, [], {});
    expect(gc()).toBe(2);
  });

  it('creates a computed that reads from a signal dependency', () => {
    const count = signal(3);
    const gc = guardedComputed(
      'tripled',
      () => count() * 3,
      [{ label: 'count', signal: count }],
      {},
    );
    expect(gc()).toBe(9);
  });

  it('deps() returns the list of dependency labels', () => {
    const a = signal(1);
    const b = signal(2);
    const gc = guardedComputed(
      'sum',
      () => a() + b(),
      [{ label: 'a', signal: a }, { label: 'b', signal: b }],
      {},
    );
    expect(gc.deps()).toEqual(['a', 'b']);
  });

  it('peek() returns value without tracking effects', () => {
    const s = signal(10);
    const gc = guardedComputed('ten', () => s(), [{ label: 's', signal: s }], {});
    expect(gc.peek()).toBe(10);
  });

  it('subscribe() fires immediately with current value', () => {
    const s = signal(5);
    const gc = guardedComputed('five', () => s(), [{ label: 's', signal: s }], {});
    const spy = vi.fn();
    const unsub = gc.subscribe(spy);
    expect(spy).toHaveBeenCalledWith(5);
    unsub();
  });
});

describe('guardedComputed — cycle detection', () => {
  it('throws CircularDependencyError when a dep references the computed label', () => {
    const s = signal(0);
    // Simulate a guarded computed that lists 'c1' as a dep of itself via another
    // We create 'dep' that declares 'c1' as its dep, then 'c1' lists 'dep' as its dep
    const dep = guardedComputed('dep', () => s(), [{ label: 's', signal: s }], { throw: false });

    // Now create a computed 'c1' whose dep 'dep' already depends on 'c1'
    // We simulate this by creating a fake dep that has deps: ['c1']
    const fakeCycleDep = Object.assign(() => 0, { deps: () => ['c1'] });

    expect(() =>
      guardedComputed(
        'c1',
        () => 0,
        [{ label: 'fakeDep', signal: fakeCycleDep }],
        { throw: true },
      ),
    ).toThrow(CircularDependencyError);
  });

  it('calls onCycle with the cycle path when cycle detected and throw: false', () => {
    const onCycle = vi.fn();
    const fakeCycleDep = Object.assign(() => 0, { deps: () => ['myComp'] });

    expect(() =>
      guardedComputed(
        'myComp',
        () => 0,
        [{ label: 'fakeDep', signal: fakeCycleDep }],
        { throw: false, onCycle },
      ),
    ).not.toThrow();
    expect(onCycle).toHaveBeenCalled();
    const cyclePath = onCycle.mock.calls[0]![0] as string[];
    expect(cyclePath).toContain('myComp');
  });

  it('CircularDependencyError has cycle property and correct message', () => {
    const cycle = ['a', 'b', 'a'];
    const err = new CircularDependencyError(cycle);
    expect(err.cycle).toEqual(cycle);
    expect(err.message).toContain('a → b → a');
    expect(err.name).toBe('CircularDependencyError');
  });
});
