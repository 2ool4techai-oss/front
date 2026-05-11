import { signal, computed } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

export interface OptimisticOptions<T> {
  onError?: (err: unknown, rollback: () => void) => void;
}

export interface OptimisticHandle<T> {
  readonly signal: Signal<T>;
  readonly pending: ComputedSignal<boolean>;
  mutate(optimisticValue: T, serverFn: () => Promise<T>): Promise<void>;
  rollback(): void;
}

export function createOptimistic<T>(
  source: Signal<T>,
  opts?: OptimisticOptions<T>,
): OptimisticHandle<T> {
  const _pending = signal<boolean>(false);
  const pendingComputed = computed<boolean>(() => _pending());
  let _snapshot: T = source.peek();

  function doRollback(): void {
    source.set(_snapshot);
  }

  async function mutate(optimisticValue: T, serverFn: () => Promise<T>): Promise<void> {
    _snapshot = source.peek();
    source.set(optimisticValue);
    _pending.set(true);

    try {
      const result = await serverFn();
      source.set(result);
      _pending.set(false);
    } catch (err) {
      doRollback();
      _pending.set(false);
      if (opts?.onError) {
        opts.onError(err, doRollback);
      }
    }
  }

  function rollback(): void {
    doRollback();
  }

  return {
    get signal(): Signal<T> { return source; },
    get pending(): ComputedSignal<boolean> { return pendingComputed; },
    mutate,
    rollback,
  };
}
