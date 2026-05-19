import { signal } from './signal.js';
import type { Signal } from './types.js';

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';
export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type NetworkClass = 'slow' | 'fast' | 'offline';

export interface Context {
  timeSlot: TimeSlot;
  device: DeviceClass;
  network: NetworkClass;
  custom?: Record<string, string>;
}

export interface ContextProfileOptions {
  dimensions?: Array<keyof Context | string>;
  storagePrefix?: string;
  onContextChange?: (from: Context, to: Context) => void;
}

export interface ContextProfile {
  currentContext: () => Context;
  contextKey: () => string;
  detect: () => Context;
  setCustom: (key: string, value: string) => void;
  onContext: (key: string, fn: (ctx: Context) => void) => () => void;
}

function detectTimeSlot(): TimeSlot {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  if (hour >= 18 && hour <= 21) return 'evening';
  return 'night';
}

function detectDevice(): DeviceClass {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const width = typeof screen !== 'undefined' ? screen.width : 1920;
  if (width < 768 || /Mobi|Android/i.test(ua)) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function detectNetwork(): NetworkClass {
  if (typeof navigator === 'undefined') return 'fast';
  if ('onLine' in navigator && !navigator.onLine) return 'offline';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (navigator as any).connection;
  if (conn) {
    const type: string = conn.effectiveType ?? '';
    if (type === '2g' || type === 'slow-2g') return 'slow';
    if (type === '4g') return 'fast';
  }
  return 'fast';
}

function buildKey(ctx: Context, dimensions: Array<string>): string {
  return dimensions
    .map((dim) => {
      if (dim === 'custom') return undefined;
      if (dim in ctx && dim !== 'custom') {
        return ((ctx as unknown) as Record<string, unknown>)[dim] as string;
      }
      if (ctx.custom && dim in ctx.custom) {
        return ctx.custom[dim];
      }
      return undefined;
    })
    .filter((v): v is string => v !== undefined)
    .join(':');
}

const DEFAULT_DIMENSIONS: Array<keyof Context> = ['timeSlot', 'device', 'network'];

export function createContextProfile(opts?: ContextProfileOptions): ContextProfile {
  const dimensions = (opts?.dimensions ?? DEFAULT_DIMENSIONS) as string[];
  const onChange = opts?.onContextChange;

  let customDims: Record<string, string> = {};

  function doDetect(): Context {
    return {
      timeSlot: detectTimeSlot(),
      device: detectDevice(),
      network: detectNetwork(),
      custom: { ...customDims },
    };
  }

  let currentCtx: Context = doDetect();
  const ctxSignal: Signal<Context> = signal<Context>(currentCtx);

  // Subscribers keyed by context key pattern
  const keySubscribers = new Map<string, Set<(ctx: Context) => void>>();

  function emitKeyChange(ctx: Context): void {
    const key = buildKey(ctx, dimensions);
    const subs = keySubscribers.get(key);
    if (subs) {
      for (const fn of subs) fn(ctx);
    }
  }

  // Re-detect every 5 minutes
  let intervalId: ReturnType<typeof setInterval> | null = null;
  if (typeof setInterval !== 'undefined') {
    intervalId = setInterval(() => {
      const prev = currentCtx;
      const next = doDetect();
      const prevKey = buildKey(prev, dimensions);
      const nextKey = buildKey(next, dimensions);
      if (prevKey !== nextKey) {
        currentCtx = next;
        ctxSignal.set(next);
        onChange?.(prev, next);
        emitKeyChange(next);
      } else {
        currentCtx = next;
      }
    }, 5 * 60 * 1000);
  }

  // Suppress unused variable warning for intervalId cleanup in GC environments
  void intervalId;

  const profile: ContextProfile = {
    currentContext(): Context {
      return ctxSignal();
    },

    contextKey(): string {
      return buildKey(ctxSignal(), dimensions);
    },

    detect(): Context {
      const prev = currentCtx;
      const next = doDetect();
      const prevKey = buildKey(prev, dimensions);
      const nextKey = buildKey(next, dimensions);
      if (prevKey !== nextKey) {
        currentCtx = next;
        ctxSignal.set(next);
        onChange?.(prev, next);
        emitKeyChange(next);
      } else {
        currentCtx = next;
      }
      return currentCtx;
    },

    setCustom(key: string, value: string): void {
      customDims = { ...customDims, [key]: value };
      const prev = currentCtx;
      const next = doDetect();
      const prevKey = buildKey(prev, dimensions);
      const nextKey = buildKey(next, dimensions);
      if (prevKey !== nextKey) {
        currentCtx = next;
        ctxSignal.set(next);
        onChange?.(prev, next);
        emitKeyChange(next);
      } else {
        currentCtx = next;
        ctxSignal.set(next);
      }
    },

    onContext(key: string, fn: (ctx: Context) => void): () => void {
      if (!keySubscribers.has(key)) {
        keySubscribers.set(key, new Set());
      }
      keySubscribers.get(key)!.add(fn);
      return () => {
        keySubscribers.get(key)?.delete(fn);
      };
    },
  };

  return profile;
}

export function useContextAdaptiveSignal<T>(
  profiles: Record<string, T>,
  defaultValue: T,
  contextProfile: ContextProfile,
): () => T {
  return function (): T {
    const key = contextProfile.contextKey();
    if (key in profiles) return profiles[key]!;

    // Fall back through partial keys (drop rightmost segment one at a time)
    const parts = key.split(':');
    for (let i = parts.length - 1; i > 0; i--) {
      const partial = parts.slice(0, i).join(':');
      if (partial in profiles) return profiles[partial]!;
    }

    return defaultValue;
  };
}
