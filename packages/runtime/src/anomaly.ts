/**
 * anomaly.ts
 * Detect when a signal changes in statistically unusual ways.
 */

import { signal } from './signal.js';

export interface AnomalyRule<T> {
  name: string;
  detect: (value: T, history: T[], context: { hour: number; dayOfWeek: number }) => boolean;
  severity: 'low' | 'medium' | 'high';
}

export interface AnomalyOptions<T> {
  historySize?: number;
  rules?: AnomalyRule<T>[];
  builtInRules?: {
    suddenJump?: boolean;
    offHours?: { startHour: number; endHour: number };
    impossibleValue?: { min?: number; max?: number };
  };
  onAnomaly?: (event: AnomalyEvent<T>) => void;
}

export interface AnomalyEvent<T> {
  value: T;
  rule: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  history: T[];
}

export interface AnomalySignal<T> {
  (): T;
  set: (v: T) => void;
  peek: () => T;
  anomalies: () => AnomalyEvent<T>[];
  clearAnomalies: () => void;
  isAnomaly: () => boolean;
}

// ── Statistical helpers ───────────────────────────────────────────────────

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const avg = mean(nums);
  const variance = nums.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / nums.length;
  return Math.sqrt(variance);
}

// ── Built-in rule builders ───────────────────────────────────────────────

function buildSuddenJumpRule<T>(): AnomalyRule<T> {
  return {
    name: 'suddenJump',
    severity: 'high',
    detect(value: T, history: T[]): boolean {
      if (typeof value !== 'number') return false;
      const nums = history.filter((h): h is T & number => typeof h === 'number') as number[];
      if (nums.length < 3) return false;
      const avg = mean(nums);
      const sd = stdDev(nums);
      if (sd === 0) return false;
      return Math.abs((value as unknown as number) - avg) > 3 * sd;
    },
  };
}

function buildOffHoursRule<T>(startHour: number, endHour: number): AnomalyRule<T> {
  return {
    name: 'offHours',
    severity: 'medium',
    detect(_value: T, _history: T[], ctx: { hour: number; dayOfWeek: number }): boolean {
      const { hour } = ctx;
      if (startHour <= endHour) {
        // e.g. 9-17: allowed hours are 9..17
        return hour < startHour || hour >= endHour;
      } else {
        // Overnight range e.g. 22-6: allowed is 22..23 or 0..5
        return hour < startHour && hour >= endHour;
      }
    },
  };
}

function buildImpossibleValueRule<T>(min?: number, max?: number): AnomalyRule<T> {
  return {
    name: 'impossibleValue',
    severity: 'high',
    detect(value: T): boolean {
      if (typeof value !== 'number') return false;
      const num = value as unknown as number;
      if (min !== undefined && num < min) return true;
      if (max !== undefined && num > max) return true;
      return false;
    },
  };
}

// ── Factory ───────────────────────────────────────────────────────────────

export function anomalySignal<T>(initial: T, opts: AnomalyOptions<T>): AnomalySignal<T> {
  const inner = signal<T>(initial);
  const historySize = opts.historySize ?? 50;
  const history: T[] = [];
  const _anomalies: AnomalyEvent<T>[] = [];
  let _lastWasAnomaly = false;

  // Build the full rule list
  const rules: AnomalyRule<T>[] = [...(opts.rules ?? [])];

  const builtIn = opts.builtInRules ?? {};
  if (builtIn.suddenJump !== false) {
    // Default: enabled
    rules.push(buildSuddenJumpRule<T>());
  }
  if (builtIn.offHours) {
    rules.push(buildOffHoursRule<T>(builtIn.offHours.startHour, builtIn.offHours.endHour));
  }
  if (builtIn.impossibleValue) {
    rules.push(buildImpossibleValueRule<T>(builtIn.impossibleValue.min, builtIn.impossibleValue.max));
  }

  function checkRules(value: T): void {
    const now = new Date();
    const ctx = { hour: now.getHours(), dayOfWeek: now.getDay() };
    let triggered = false;

    for (const rule of rules) {
      if (rule.detect(value, [...history], ctx)) {
        triggered = true;
        const event: AnomalyEvent<T> = {
          value,
          rule: rule.name,
          severity: rule.severity,
          timestamp: Date.now(),
          history: [...history],
        };
        _anomalies.push(event);
        opts.onAnomaly?.(event);
      }
    }

    _lastWasAnomaly = triggered;

    // Update history after checking (history does not include current value yet during detection)
    history.push(value);
    if (history.length > historySize) {
      history.shift();
    }
  }

  // Record initial value in history (no anomaly check for initial)
  history.push(initial);

  const sig = Object.assign(
    function (): T {
      return inner();
    },
    {
      set(v: T): void {
        checkRules(v);
        inner.set(v);
      },

      peek(): T {
        return inner.peek();
      },

      anomalies(): AnomalyEvent<T>[] {
        return [..._anomalies];
      },

      clearAnomalies(): void {
        _anomalies.length = 0;
        _lastWasAnomaly = false;
      },

      isAnomaly(): boolean {
        return _lastWasAnomaly;
      },
    },
  ) as AnomalySignal<T>;

  return sig;
}
