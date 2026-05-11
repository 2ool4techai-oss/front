import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBandit, createIntentGatedFlag, createAutoRollout } from '../ab.js';
import { createFlag } from '../flags.js';
import { signal } from '../signal.js';

// localStorage mock
const lsStore: Record<string, string> = {};
const localStorageMock = {
  getItem:    (k: string) => lsStore[k] ?? null,
  setItem:    (k: string, v: string) => { lsStore[k] = v; },
  removeItem: (k: string) => { delete lsStore[k]; },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  for (const k of Object.keys(lsStore)) delete lsStore[k];
});

// ── Bandit tests ───────────────────────────────────────────────────────

describe('createBandit', () => {
  it('initializes with equal arms (0 trials, 0 wins)', () => {
    const bandit = createBandit({ arms: ['control', 'treatment-a', 'treatment-b'] });
    const arms = bandit.arms();
    expect(arms).toHaveLength(3);
    for (const arm of arms) {
      expect(arm.trials).toBe(0);
      expect(arm.wins).toBe(0);
      expect(arm.winRate).toBe(0);
    }
  });

  it('select() returns one of the arm IDs', () => {
    const bandit = createBandit({ arms: ['control', 'treatment-a'] });
    const chosen = bandit.select();
    expect(['control', 'treatment-a']).toContain(chosen);
  });

  it('recordWin() increments wins and trials for the selected arm', () => {
    const bandit = createBandit({ arms: ['control', 'treatment-a'] });
    bandit.selected.set('control');
    bandit.recordWin();
    const ctrl = bandit.arms().find(a => a.id === 'control')!;
    expect(ctrl.wins).toBe(1);
    expect(ctrl.trials).toBe(1);
    expect(ctrl.winRate).toBeCloseTo(1);
  });

  it('recordWin(id) increments wins for specified arm', () => {
    const bandit = createBandit({ arms: ['control', 'treatment-a'] });
    bandit.recordWin('treatment-a');
    const ta = bandit.arms().find(a => a.id === 'treatment-a')!;
    expect(ta.wins).toBe(1);
    expect(ta.trials).toBe(1);
  });

  it('epsilon-greedy with epsilon=1 always explores (random arm)', () => {
    // With epsilon=1 every call is random — we just check it stays within valid arms
    const arms = ['c', 'ta', 'tb'];
    const bandit = createBandit({ arms, algorithm: 'epsilon-greedy', epsilon: 1 });
    for (let i = 0; i < 20; i++) {
      expect(arms).toContain(bandit.select());
    }
  });

  it('epsilon-greedy with epsilon=0 exploits the best arm', () => {
    const bandit = createBandit({ arms: ['control', 'treatment'], algorithm: 'epsilon-greedy', epsilon: 0 });
    // Give treatment a high win rate
    for (let i = 0; i < 5; i++) bandit.recordWin('treatment');
    // control: 0/0 → rate 0.5 (exploration prior); treatment: 5/5 → 1.0
    // With epsilon=0, should always pick treatment
    for (let i = 0; i < 10; i++) {
      expect(bandit.select()).toBe('treatment');
    }
  });

  it('ucb1 algorithm: arms with 0 trials are selected first', () => {
    const bandit = createBandit({ arms: ['a', 'b', 'c'], algorithm: 'ucb1' });
    // All arms start at 0 trials → Infinity score → first arm wins ties
    const chosen = bandit.select();
    // It should pick one of the arms (all have Infinity score, first picked)
    expect(['a', 'b', 'c']).toContain(chosen);
    // After a few wins on 'a', arms without trials still have Infinity
    bandit.recordWin('a');
    bandit.recordWin('a');
    const next = bandit.select();
    // b and c still have 0 trials so score = Infinity
    expect(['b', 'c']).toContain(next);
  });

  it('thompson algorithm: returns valid arm', () => {
    const bandit = createBandit({ arms: ['x', 'y', 'z'], algorithm: 'thompson' });
    for (let i = 0; i < 10; i++) {
      expect(['x', 'y', 'z']).toContain(bandit.select());
    }
  });

  it('winner is null when no arm has >= 10 trials', () => {
    const bandit = createBandit({ arms: ['a', 'b'] });
    bandit.recordWin('a');
    bandit.recordWin('a');
    expect(bandit.winner()).toBeNull();
  });

  it('winner returns arm with highest win rate after >= 10 trials', () => {
    const bandit = createBandit({ arms: ['a', 'b'] });
    // Give 'a' 10 trials, 8 wins → 0.8
    for (let i = 0; i < 8; i++) bandit.recordWin('a');
    // Fill trials to 10 for 'a' without wins by calling recordWin on 'b' to pad
    // Actually recordWin increments both wins and trials — so let's do it differently
    // We need 10 trials total for each arm to qualify
    // Use recordWin for 'b' to build 10 trials with 5 wins → 0.5
    for (let i = 0; i < 5; i++) bandit.recordWin('b');
    // Now 'a' has 8 trials (8 wins), 'b' has 5 trials (5 wins) — neither qualifies
    // We need to add more trials to 'a' without wins → can't with current API
    // Let's add wins to both to get 10 trials
    for (let i = 0; i < 2; i++) bandit.recordWin('a');  // a: 10 trials, 10 wins → 1.0
    for (let i = 0; i < 5; i++) bandit.recordWin('b');  // b: 10 trials, 10 wins → 1.0
    // Both now at 1.0 with 10 trials — first one (a) should win on tie
    const w = bandit.winner();
    expect(w).toBe('a');
  });

  it('reset() zeroes all stats', () => {
    const bandit = createBandit({ arms: ['a', 'b'] });
    bandit.recordWin('a');
    bandit.recordWin('b');
    bandit.reset();
    for (const arm of bandit.arms()) {
      expect(arm.trials).toBe(0);
      expect(arm.wins).toBe(0);
    }
  });

  it('arms signal reflects current stats after recordWin', () => {
    const bandit = createBandit({ arms: ['x', 'y'] });
    bandit.recordWin('x');
    bandit.recordWin('x');
    const x = bandit.arms().find(a => a.id === 'x')!;
    expect(x.trials).toBe(2);
    expect(x.wins).toBe(2);
    expect(x.winRate).toBeCloseTo(1);
  });
});

// ── Intent-gated tests ─────────────────────────────────────────────────

describe('createIntentGatedFlag', () => {
  it('effectiveVariant matches flag value when intent is allowed', () => {
    const flag   = createFlag<string>('ig-flag', { defaultValue: 'control', variants: ['control', 'treatment'], rollout: 1 });
    const intent = signal<string>('reading');
    const gated  = createIntentGatedFlag({ flag, intentSignal: intent });
    expect(gated.effectiveVariant()).toBe(flag.value());
  });

  it('effectiveVariant returns fallbackVariant when intent not allowed', () => {
    const flag   = createFlag<string>('ig-flag2', { defaultValue: 'treatment' });
    flag.override('treatment');
    const intent = signal<string>('frustrated');
    const gated  = createIntentGatedFlag({ flag, intentSignal: intent, fallbackVariant: 'control' });
    expect(gated.effectiveVariant()).toBe('control');
  });

  it('isActive is true for allowed intent', () => {
    const flag   = createFlag<string>('ig-flag3', { defaultValue: 'a' });
    const intent = signal<string>('exploring');
    const gated  = createIntentGatedFlag({ flag, intentSignal: intent, allowedIntents: ['reading', 'exploring'] });
    expect(gated.isActive()).toBe(true);
  });

  it('isActive is false for disallowed intent', () => {
    const flag   = createFlag<string>('ig-flag4', { defaultValue: 'a' });
    const intent = signal<string>('idle');
    const gated  = createIntentGatedFlag({ flag, intentSignal: intent, allowedIntents: ['reading', 'exploring'] });
    expect(gated.isActive()).toBe(false);
  });
});

// ── Auto-rollout tests ─────────────────────────────────────────────────

describe('createAutoRollout', () => {
  it('starts at initialRollout', () => {
    const ar = createAutoRollout({ initialRollout: 0.1, intervalMs: 999_999_999 });
    expect(ar.rollout()).toBeCloseTo(0.1);
    ar.destroy();
  });

  it('step() increments by stepSize', () => {
    const ar = createAutoRollout({ initialRollout: 0.1, stepSize: 0.05, intervalMs: 999_999_999 });
    ar.step();
    expect(ar.rollout()).toBeCloseTo(0.15);
    ar.destroy();
  });

  it('step() caps at targetRollout', () => {
    const ar = createAutoRollout({ initialRollout: 0.95, stepSize: 0.1, targetRollout: 1.0, intervalMs: 999_999_999 });
    ar.step();
    expect(ar.rollout()).toBeCloseTo(1.0);
    ar.destroy();
  });

  it('pause() sets paused to true', () => {
    const ar = createAutoRollout({ intervalMs: 999_999_999 });
    ar.pause('manual');
    expect(ar.paused()).toBe(true);
    ar.destroy();
  });

  it('errorSignal above threshold triggers pause on step()', () => {
    const errorSig = signal<number>(0.1); // above default threshold 0.05
    const ar = createAutoRollout({
      initialRollout: 0.1,
      errorSignal: errorSig,
      errorThreshold: 0.05,
      intervalMs: 999_999_999,
    });
    expect(ar.paused()).toBe(false);
    ar.step();
    expect(ar.paused()).toBe(true);
    // rollout should NOT have changed
    expect(ar.rollout()).toBeCloseTo(0.1);
    ar.destroy();
  });
});
