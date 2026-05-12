import { signal, label } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface SemanticMeta {
  description: string;
  unit?: string;           // 'USD', 'ms', 'count', 'percent'
  tags?: string[];
  intent?: string;         // 'user-preference', 'business-metric', 'ui-state'
  range?: { min?: number; max?: number };
  enum?: string[];         // allowed string values
}

export interface SemanticSignalType<T> extends Signal<T> {
  readonly meta: SemanticMeta;
  readonly id: string;
}

// ── Registry ───────────────────────────────────────────────────────────

const _registry = new Map<string, { meta: SemanticMeta; peek: () => unknown }>();
let _idCounter = 0;

export function getSemanticRegistry(): Map<string, SemanticMeta> {
  const out = new Map<string, SemanticMeta>();
  for (const [id, entry] of _registry) {
    out.set(id, entry.meta);
  }
  return out;
}

// ── semanticSignal ─────────────────────────────────────────────────────

export function semanticSignal<T>(initial: T, meta: SemanticMeta): SemanticSignalType<T> {
  const id = `semantic_${++_idCounter}_${meta.description.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32)}`;
  const base = signal<T>(initial);

  // Give it a dev label for time-travel / devtools
  label(base, id);

  const sem = Object.assign(base, {
    meta,
    id,
  }) as SemanticSignalType<T>;

  _registry.set(id, { meta, peek: () => sem.peek() });

  return sem;
}

// ── describeAppState ───────────────────────────────────────────────────

export function describeAppState(): object {
  const result: Record<string, unknown> = {};

  for (const [id, entry] of _registry) {
    result[id] = {
      value: entry.peek(),
      ...entry.meta,
    };
  }

  return result;
}

// ── clearSemanticRegistry (for testing) ───────────────────────────────

export function _clearSemanticRegistry(): void {
  _registry.clear();
}
