import { describe, it, expect } from 'vitest';
import { createSignalGraph } from '../signal-graph.js';

describe('createSignalGraph', () => {
  it('starts empty', () => {
    const graph = createSignalGraph();
    expect(graph.getGraph().nodes.size).toBe(0);
    expect(graph.getGraph().edges.length).toBe(0);
  });

  it('register adds a node', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'counter', 'signal', () => 0);
    expect(graph.getGraph().nodes.has('n1')).toBe(true);
    expect(graph.getGraph().nodes.get('n1')?.label).toBe('counter');
  });

  it('recordDependency adds an edge', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'counter', 'signal', () => 0);
    graph.register('n2', 'doubled', 'computed', () => 0);
    graph.recordDependency('n1', 'n2');
    expect(graph.getGraph().edges).toHaveLength(1);
    expect(graph.getGraph().edges[0]).toEqual({ from: 'n1', to: 'n2' });
  });

  it('recordUpdate increments updateCount', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'counter', 'signal', () => 0);
    graph.recordUpdate('n1');
    graph.recordUpdate('n1');
    expect(graph.getGraph().nodes.get('n1')?.updateCount).toBe(2);
  });

  it('analyze finds hot nodes', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'counter', 'signal', () => 0);
    graph.register('n2', 'other', 'signal', () => 0);
    for (let i = 0; i < 10; i++) graph.recordUpdate('n1');
    graph.recordUpdate('n2');
    const analysis = graph.analyze();
    expect(analysis.hotNodes[0].label).toBe('counter');
  });

  it('analyze finds isolated nodes', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'lonely', 'signal', () => 0);
    const analysis = graph.analyze();
    expect(analysis.isolatedNodes.some(n => n.label === 'lonely')).toBe(true);
  });

  it('analyze detects cycles', () => {
    const graph = createSignalGraph();
    graph.register('a', 'a', 'signal', () => 0);
    graph.register('b', 'b', 'computed', () => 0);
    graph.recordDependency('a', 'b');
    graph.recordDependency('b', 'a');  // cycle: a→b→a
    const analysis = graph.analyze();
    expect(analysis.cycles.length).toBeGreaterThan(0);
  });

  it('toJSON / fromJSON round-trips', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'counter', 'signal', () => 42);
    const json = graph.toJSON();
    const graph2 = createSignalGraph();
    graph2.fromJSON(json);
    expect(graph2.getGraph().nodes.has('n1')).toBe(true);
  });

  it('toDOT returns a valid DOT string', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'counter', 'signal', () => 0);
    const dot = graph.toDOT();
    expect(dot).toContain('digraph');
    expect(dot).toContain('counter');
  });

  it('toMermaid returns a valid mermaid string', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'counter', 'signal', () => 0);
    const mermaid = graph.toMermaid();
    expect(mermaid).toContain('graph');
    expect(mermaid).toContain('counter');
  });

  it('clear resets graph', () => {
    const graph = createSignalGraph();
    graph.register('n1', 'counter', 'signal', () => 0);
    graph.clear();
    expect(graph.getGraph().nodes.size).toBe(0);
  });
});
