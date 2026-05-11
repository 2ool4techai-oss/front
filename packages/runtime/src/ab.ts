import { signal, computed } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';
import type { FlagHandle } from './flags.js';

// ── Bandit ──────────────────────────────────────────────────────────────

export type BanditAlgorithm = 'epsilon-greedy' | 'ucb1' | 'thompson';

export interface BanditArm {
  id:      string;
  trials:  number;
  wins:    number;
  winRate: number;
}

export interface BanditOptions {
  arms:        string[];
  algorithm?:  BanditAlgorithm;
  epsilon?:    number;
  storageKey?: string;
  onWin?:      (armId: string) => void;
  onSelect?:   (armId: string) => void;
}

export interface BanditHandle {
  readonly selected: Signal<string>;
  readonly arms:     Signal<BanditArm[]>;
  readonly winner:   ComputedSignal<string | null>;
  select(): string;
  recordWin(armId?: string): void;
  reset(): void;
}

// ── Thompson sampling helpers ──────────────────────────────────────────

function randn(): number {
  return Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function gammaSample(shape: number): number {
  if (shape < 1) return gammaSample(1 + shape) * Math.pow(Math.random(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  let iterations = 0;
  while (iterations++ < 1000) {
    let x: number, v: number;
    do { x = randn(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d; // fallback
}

function betaSample(a: number, b: number): number {
  const x = gammaSample(a);
  const y = gammaSample(b);
  return x / (x + y);
}

export function createBandit(opts: BanditOptions): BanditHandle {
  const algorithm = opts.algorithm ?? 'epsilon-greedy';
  const epsilon   = opts.epsilon   ?? 0.1;

  // Load persisted stats
  function loadStats(): BanditArm[] {
    if (opts.storageKey && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(opts.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as BanditArm[];
          // Ensure all arms are present
          return opts.arms.map(id => {
            const found = parsed.find(a => a.id === id);
            return found ?? { id, trials: 0, wins: 0, winRate: 0 };
          });
        }
      } catch {
        // ignore
      }
    }
    return opts.arms.map(id => ({ id, trials: 0, wins: 0, winRate: 0 }));
  }

  function saveStats(arms: BanditArm[]): void {
    if (opts.storageKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(opts.storageKey, JSON.stringify(arms));
      } catch {
        // ignore
      }
    }
  }

  const armsSignal   = signal<BanditArm[]>(loadStats());
  const selectedSignal = signal<string>(opts.arms[0] ?? '');

  const winner = computed<string | null>(() => {
    const all = armsSignal();
    const qualified = all.filter(a => a.trials >= 10);
    if (qualified.length === 0) return null;
    let best = qualified[0]!;
    for (const arm of qualified) {
      if (arm.winRate > best.winRate) best = arm;
    }
    return best.id;
  });

  function pickEpsilonGreedy(): string {
    const arms = armsSignal();
    if (Math.random() < epsilon) {
      // explore: pick random arm
      return arms[Math.floor(Math.random() * arms.length)]!.id;
    }
    // exploit: pick best arm (tie-break: first in array)
    let best = arms[0]!;
    for (const arm of arms) {
      const rate = arm.trials === 0 ? 0.5 : arm.winRate;
      const bestRate = best.trials === 0 ? 0.5 : best.winRate;
      if (rate > bestRate) best = arm;
    }
    return best.id;
  }

  function pickUCB1(): string {
    const arms = armsSignal();
    const totalTrials = arms.reduce((s, a) => s + a.trials, 0);

    let bestId = arms[0]!.id;
    let bestScore = -Infinity;

    for (const arm of arms) {
      let score: number;
      if (arm.trials === 0) {
        score = Infinity;
      } else {
        score = arm.winRate + Math.sqrt(2 * Math.log(totalTrials) / arm.trials);
      }
      if (score > bestScore) {
        bestScore = score;
        bestId = arm.id;
      }
    }
    return bestId;
  }

  function pickThompson(): string {
    const arms = armsSignal();
    let bestId = arms[0]!.id;
    let bestSample = -Infinity;

    for (const arm of arms) {
      const alpha = arm.wins + 1;
      const beta  = arm.trials - arm.wins + 1;
      const sample = betaSample(alpha, beta);
      if (sample > bestSample) {
        bestSample = sample;
        bestId = arm.id;
      }
    }
    return bestId;
  }

  function select(): string {
    let chosen: string;
    switch (algorithm) {
      case 'ucb1':     chosen = pickUCB1();          break;
      case 'thompson': chosen = pickThompson();       break;
      default:         chosen = pickEpsilonGreedy();  break;
    }
    selectedSignal.set(chosen);
    opts.onSelect?.(chosen);
    return chosen;
  }

  function recordWin(armId?: string): void {
    const id = armId ?? selectedSignal();
    const arms = armsSignal().map(a => {
      if (a.id !== id) return a;
      const wins   = a.wins + 1;
      const trials = a.trials + 1;
      return { ...a, wins, trials, winRate: wins / trials };
    });
    armsSignal.set(arms);
    saveStats(arms);
    opts.onWin?.(id);
  }

  function reset(): void {
    const fresh = opts.arms.map(id => ({ id, trials: 0, wins: 0, winRate: 0 }));
    armsSignal.set(fresh);
    if (opts.storageKey && typeof window !== 'undefined') {
      try { localStorage.removeItem(opts.storageKey); } catch { /* ignore */ }
    }
  }

  return {
    selected: selectedSignal,
    arms:     armsSignal,
    winner,
    select,
    recordWin,
    reset,
  };
}

// ── Intent-Gated Experiments ────────────────────────────────────────────

export interface IntentGatedOptions<T extends string> {
  flag:             FlagHandle<T>;
  allowedIntents?:  string[];
  fallbackVariant?: T;
  intentSignal:     Signal<string>;
}

export interface IntentGatedHandle<T extends string> {
  readonly effectiveVariant: ComputedSignal<T>;
  readonly isActive:         ComputedSignal<boolean>;
}

export function createIntentGatedFlag<T extends string>(
  opts: IntentGatedOptions<T>,
): IntentGatedHandle<T> {
  const allowedIntents = opts.allowedIntents ?? ['reading', 'exploring'];

  const isActive = computed<boolean>(() => allowedIntents.includes(opts.intentSignal()));

  const effectiveVariant = computed<T>(() => {
    if (isActive()) return opts.flag.value();
    if (opts.fallbackVariant !== undefined) return opts.fallbackVariant;
    return opts.flag.value();
  });

  return { effectiveVariant, isActive };
}

// ── Auto-Rollout with Circuit Breaker ──────────────────────────────────

export interface AutoRolloutOptions {
  initialRollout?:  number;
  targetRollout?:   number;
  stepSize?:        number;
  intervalMs?:      number;
  errorSignal?:     Signal<number>;
  errorThreshold?:  number;
  onStep?:          (rollout: number) => void;
  onPause?:         (reason: string) => void;
  storageKey?:      string;
}

export interface AutoRolloutHandle {
  readonly rollout: Signal<number>;
  readonly paused:  Signal<boolean>;
  readonly phase:   ComputedSignal<'ramping' | 'paused' | 'complete'>;
  step():   void;
  pause(reason?: string): void;
  resume(): void;
  reset():  void;
  destroy(): void;
}

export function createAutoRollout(opts?: AutoRolloutOptions): AutoRolloutHandle {
  const initialRollout  = opts?.initialRollout  ?? 0.05;
  const targetRollout   = opts?.targetRollout   ?? 1.0;
  const stepSize        = opts?.stepSize        ?? 0.05;
  const intervalMs      = opts?.intervalMs      ?? 3_600_000;
  const errorThreshold  = opts?.errorThreshold  ?? 0.05;
  const storageKey      = opts?.storageKey;

  function loadRollout(): number {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw !== null) return Number(JSON.parse(raw));
      } catch { /* ignore */ }
    }
    return initialRollout;
  }

  function saveRollout(v: number): void {
    if (storageKey && typeof window !== 'undefined') {
      try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* ignore */ }
    }
  }

  const rollout = signal<number>(loadRollout());
  const paused  = signal<boolean>(false);

  const phase = computed<'ramping' | 'paused' | 'complete'>(() => {
    if (paused()) return 'paused';
    if (rollout() >= targetRollout) return 'complete';
    return 'ramping';
  });

  function pause(reason?: string): void {
    paused.set(true);
    opts?.onPause?.(reason ?? 'manual');
  }

  function resume(): void {
    paused.set(false);
  }

  function step(): void {
    // Check error signal
    if (opts?.errorSignal) {
      const errRate = opts.errorSignal();
      if (errRate > errorThreshold) {
        pause('error-rate-exceeded');
        return;
      }
    }

    if (paused()) return;

    const current  = rollout();
    const next     = Math.min(current + stepSize, targetRollout);
    rollout.set(next);
    saveRollout(next);
    opts?.onStep?.(next);
  }

  function reset(): void {
    rollout.set(initialRollout);
    paused.set(false);
    if (storageKey && typeof window !== 'undefined') {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  if (typeof setInterval !== 'undefined') {
    intervalId = setInterval(() => { step(); }, intervalMs);
  }

  function destroy(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  return { rollout, paused, phase, step, pause, resume, reset, destroy };
}
