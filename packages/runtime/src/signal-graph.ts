export interface SignalNode {
  id: string;
  label: string;
  type: 'signal' | 'computed' | 'effect';
  value: unknown;
  dependencies: string[];
  dependents: string[];
  updateCount: number;
  lastUpdatedMs: number | null;
}

export interface SignalGraph {
  nodes: Map<string, SignalNode>;
  edges: Array<{ from: string; to: string }>;
}

export interface GraphAnalysis {
  totalNodes: number;
  totalEdges: number;
  hotNodes: SignalNode[];
  isolatedNodes: SignalNode[];
  longestChain: string[];
  cycles: string[][];
}

export interface SignalGraphHandle {
  register: (id: string, label: string, type: SignalNode['type'], getValue: () => unknown) => void;
  recordDependency: (fromId: string, toId: string) => void;
  recordUpdate: (id: string) => void;
  getGraph: () => SignalGraph;
  analyze: () => GraphAnalysis;
  toJSON: () => string;
  fromJSON: (json: string) => void;
  clear: () => void;
  toDOT: () => string;
  toMermaid: () => string;
}

export function createSignalGraph(): SignalGraphHandle {
  const nodes = new Map<string, SignalNode>();
  let edges: Array<{ from: string; to: string }> = [];
  const getValueFns = new Map<string, () => unknown>();

  function register(
    id: string,
    label: string,
    type: SignalNode['type'],
    getValue: () => unknown,
  ): void {
    getValueFns.set(id, getValue);
    nodes.set(id, {
      id,
      label,
      type,
      value: safeValue(getValue),
      dependencies: [],
      dependents: [],
      updateCount: 0,
      lastUpdatedMs: null,
    });
  }

  function safeValue(getValue: () => unknown): unknown {
    try {
      const v = getValue();
      // Ensure it's JSON-serializable by round-tripping
      return JSON.parse(JSON.stringify(v ?? null));
    } catch {
      return null;
    }
  }

  function recordDependency(fromId: string, toId: string): void {
    // Avoid duplicate edges
    const exists = edges.some(e => e.from === fromId && e.to === toId);
    if (exists) return;

    edges.push({ from: fromId, to: toId });

    const fromNode = nodes.get(fromId);
    if (fromNode && !fromNode.dependents.includes(toId)) {
      fromNode.dependents.push(toId);
    }

    const toNode = nodes.get(toId);
    if (toNode && !toNode.dependencies.includes(fromId)) {
      toNode.dependencies.push(fromId);
    }
  }

  function recordUpdate(id: string): void {
    const node = nodes.get(id);
    if (!node) return;
    node.updateCount++;
    node.lastUpdatedMs = Date.now();
    const getFn = getValueFns.get(id);
    if (getFn) {
      node.value = safeValue(getFn);
    }
  }

  function getGraph(): SignalGraph {
    return { nodes, edges };
  }

  function analyze(): GraphAnalysis {
    const allNodes = Array.from(nodes.values());
    const totalNodes = allNodes.length;
    const totalEdges = edges.length;

    // Hot nodes: top 5 by updateCount
    const hotNodes = [...allNodes]
      .sort((a, b) => b.updateCount - a.updateCount)
      .slice(0, 5);

    // Isolated nodes: no deps and no dependents
    const isolatedNodes = allNodes.filter(
      n => n.dependencies.length === 0 && n.dependents.length === 0,
    );

    // Longest chain: DFS from every node, find longest path
    const longestChain = findLongestChain();

    // Cycle detection
    const cycles = detectCycles();

    return { totalNodes, totalEdges, hotNodes, isolatedNodes, longestChain, cycles };
  }

  function findLongestChain(): string[] {
    // Build adjacency from edges (from -> to means dependency direction)
    // A "chain" goes from a root (no dependencies) through dependents
    // We treat edges as from=dependency, to=dependent
    // So we traverse: follow dependents (i.e., the "to" side)

    let best: string[] = [];

    function dfs(nodeId: string, visited: Set<string>, path: string[]): void {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodes.get(nodeId);
      if (!node) return;

      path.push(node.label);
      if (path.length > best.length) {
        best = [...path];
      }

      for (const depId of node.dependents) {
        dfs(depId, visited, path);
      }

      path.pop();
      visited.delete(nodeId);
    }

    for (const node of nodes.values()) {
      dfs(node.id, new Set(), []);
    }

    return best;
  }

  function detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const stackPath: string[] = [];

    function dfs(nodeId: string): void {
      if (stack.has(nodeId)) {
        // Found a cycle — extract the cycle portion
        const cycleStart = stackPath.indexOf(nodeId);
        const cyclePath = stackPath.slice(cycleStart).map(id => nodes.get(id)?.label ?? id);
        cycles.push(cyclePath);
        return;
      }
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      stack.add(nodeId);
      stackPath.push(nodeId);

      const node = nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependents) {
          dfs(depId);
        }
      }

      stackPath.pop();
      stack.delete(nodeId);
    }

    for (const nodeId of nodes.keys()) {
      dfs(nodeId);
    }

    return cycles;
  }

  function toJSON(): string {
    // Snapshot current values
    const snapshot: {
      nodes: Array<SignalNode>;
      edges: Array<{ from: string; to: string }>;
    } = {
      nodes: Array.from(nodes.values()).map(n => {
        const getFn = getValueFns.get(n.id);
        return {
          ...n,
          value: getFn ? safeValue(getFn) : n.value,
        };
      }),
      edges,
    };
    return JSON.stringify(snapshot);
  }

  function fromJSON(json: string): void {
    const data = JSON.parse(json) as {
      nodes: Array<SignalNode>;
      edges: Array<{ from: string; to: string }>;
    };

    nodes.clear();
    edges = [];
    getValueFns.clear();

    for (const n of data.nodes) {
      const captured = n.value;
      nodes.set(n.id, { ...n });
      getValueFns.set(n.id, () => captured);
    }

    for (const e of data.edges) {
      edges.push(e);
    }
  }

  function clear(): void {
    nodes.clear();
    edges = [];
    getValueFns.clear();
  }

  function toDOT(): string {
    const lines: string[] = ['digraph SignalGraph {', '  rankdir=LR;'];

    for (const node of nodes.values()) {
      const shape =
        node.type === 'signal' ? 'box' : node.type === 'computed' ? 'ellipse' : 'diamond';
      const lbl = `${node.label}\\nvalue: ${JSON.stringify(node.value)}\\nupdates: ${node.updateCount}`;
      lines.push(`  "${node.label}" [label="${lbl}" shape=${shape}];`);
    }

    for (const edge of edges) {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (from && to) {
        lines.push(`  "${from.label}" -> "${to.label}";`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  function toMermaid(): string {
    const lines: string[] = ['graph LR'];

    for (const node of nodes.values()) {
      const val = JSON.stringify(node.value);
      if (node.type === 'signal') {
        lines.push(`  ${node.id}["${node.label}: ${val}"]`);
      } else if (node.type === 'computed') {
        lines.push(`  ${node.id}(["${node.label}: ${val}"])`);
      } else {
        lines.push(`  ${node.id}{"${node.label}: ${val}"}`);
      }
    }

    for (const edge of edges) {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (from && to) {
        lines.push(`  ${edge.from} --> ${edge.to}`);
      }
    }

    return lines.join('\n');
  }

  return {
    register,
    recordDependency,
    recordUpdate,
    getGraph,
    analyze,
    toJSON,
    fromJSON,
    clear,
    toDOT,
    toMermaid,
  };
}
