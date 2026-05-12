import { computed } from './signal.js';

export class CircularDependencyError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
  }
}

export interface CircularGuardOptions {
  maxDepth?: number;        // max dependency chain depth before flagging. Default: 20
  onCycle?: (cycle: string[]) => void;
  throw?: boolean;          // throw instead of just calling onCycle. Default: true
}

export interface GuardedComputed<T> {
  (): T;
  peek: () => T;
  subscribe: (fn: (v: T) => void) => () => void;
  deps: () => string[];     // list of dependency labels
}

/**
 * Pure utility: returns array of cycles found in a directed graph using DFS.
 */
export function detectCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stackPath: string[] = [];

  function dfs(node: string): void {
    if (inStack.has(node)) {
      // Found a cycle — extract the cycle portion of the current path
      const cycleStart = stackPath.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push([...stackPath.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stackPath.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    stackPath.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

export function guardedComputed<T>(
  label: string,
  fn: () => T,
  deps: Array<{ label: string; signal: () => unknown }>,
  opts?: CircularGuardOptions,
): GuardedComputed<T> {
  const maxDepth = opts?.maxDepth ?? 20;
  const shouldThrow = opts?.throw ?? true;

  // Build a dependency graph: label → [dep labels]
  // We need to check if any of the deps form a cycle that includes `label`
  const graph = new Map<string, string[]>();

  // Add the current computed's dependencies
  graph.set(label, deps.map(d => d.label));

  // For each dep, if it's also a GuardedComputed, collect its deps too
  // (we do this by checking if the dep signal has a `deps` method)
  function collectDepsRecursively(depLabel: string, depSignal: () => unknown, depth: number): void {
    if (depth > maxDepth) {
      const depChain = [label, depLabel];
      if (shouldThrow) {
        throw new CircularDependencyError(depChain);
      }
      opts?.onCycle?.(depChain);
      return;
    }

    if (graph.has(depLabel)) return; // already visited

    const guardedDep = depSignal as unknown as GuardedComputed<unknown>;
    if (typeof guardedDep.deps === 'function') {
      const subDeps = guardedDep.deps();
      graph.set(depLabel, subDeps);
      // We don't have signal references for transitive deps, but the labels are enough
      // for cycle detection. Add placeholder entries if not already in graph.
      for (const subDep of subDeps) {
        if (!graph.has(subDep)) {
          graph.set(subDep, []);
        }
      }
    } else {
      graph.set(depLabel, []);
    }
  }

  for (const dep of deps) {
    collectDepsRecursively(dep.label, dep.signal, 0);
  }

  // Run cycle detection
  const cycles = detectCycles(graph);

  if (cycles.length > 0) {
    const cycle = cycles[0]!;
    opts?.onCycle?.(cycle);
    if (shouldThrow) {
      throw new CircularDependencyError(cycle);
    }
  }

  // Safe — create a real computed
  const inner = computed(fn);

  const guardedSig = Object.assign(
    function (): T {
      return inner();
    },
    {
      peek: (): T => inner.peek(),
      subscribe: (cb: (v: T) => void): (() => void) => inner.subscribe(cb),
      deps: (): string[] => deps.map(d => d.label),
    },
  ) as GuardedComputed<T>;

  return guardedSig;
}
