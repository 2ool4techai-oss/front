import { signal } from './signal.js';

export interface BoundedOptions<T> {
  maxSize: number;
  strategy?: 'drop-oldest' | 'drop-newest' | 'throw'; // Default: 'drop-oldest'
  onBound?: (dropped: T[], current: T[]) => void;
}

export interface BoundedSignal<T> {
  (): T[];
  set: (v: T[]) => void;
  push: (...items: T[]) => void; // add items, respecting bound
  peek: () => T[];
  isFull: () => boolean;
  capacity: () => number;        // maxSize
  size: () => number;            // current length
}

export function boundedSignal<T>(initial: T[], opts: BoundedOptions<T>): BoundedSignal<T> {
  const { maxSize, strategy = 'drop-oldest' } = opts;

  if (maxSize < 1) {
    throw new RangeError(`[DRISHTI] boundedSignal: maxSize must be >= 1, got ${maxSize}`);
  }

  function applyBound(items: T[]): { result: T[]; dropped: T[] } {
    if (items.length <= maxSize) {
      return { result: items, dropped: [] };
    }

    if (strategy === 'throw') {
      throw new RangeError(
        `[DRISHTI] boundedSignal: array size ${items.length} exceeds maxSize ${maxSize}`,
      );
    }

    if (strategy === 'drop-oldest') {
      const dropped = items.slice(0, items.length - maxSize);
      const result = items.slice(items.length - maxSize);
      return { result, dropped };
    }

    // drop-newest: keep first maxSize items, discard overflow
    const result = items.slice(0, maxSize);
    const dropped = items.slice(maxSize);
    return { result, dropped };
  }

  // Validate and apply bound to initial value
  const { result: safeInitial } = applyBound(initial);
  const inner = signal<T[]>(safeInitial);

  const boundedSet = (v: T[]): void => {
    const { result, dropped } = applyBound(v);
    if (dropped.length > 0) {
      console.warn(
        `[DRISHTI] boundedSignal: dropped ${dropped.length} item(s) (strategy: ${strategy})`,
      );
      opts.onBound?.(dropped, result);
    }
    inner.set(result);
  };

  const push = (...items: T[]): void => {
    const current = inner.peek();
    const combined = [...current, ...items];
    boundedSet(combined);
  };

  const sig = Object.assign(
    function (): T[] {
      return inner();
    },
    {
      set: boundedSet,
      push,
      peek: (): T[] => inner.peek(),
      isFull: (): boolean => inner.peek().length >= maxSize,
      capacity: (): number => maxSize,
      size: (): number => inner.peek().length,
    },
  ) as BoundedSignal<T>;

  return sig;
}
