import { signal } from './signal.js';
import type { SpringSignal, SpringConfig, TweenSignal, TweenConfig, SignalSubscriber, Unsubscribe } from './types.js';

// ── Easing functions ───────────────────────────────────────────────────
export const Easing = {
  linear:     (t: number) => t,
  easeIn:     (t: number) => t * t,
  easeOut:    (t: number) => t * (2 - t),
  easeInOut:  (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  cubicIn:    (t: number) => t * t * t,
  cubicOut:   (t: number) => (--t) * t * t + 1,
  cubicInOut: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  elasticOut: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
  },
  bounceOut:  (t: number) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  springOut: (t: number) => {
    // Approximates spring overshoot without real physics
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} as const;

// ── spring() ───────────────────────────────────────────────────────────
// Physics-based animation: value smoothly follows target via spring forces.
// spring.to(value) → animate  |  spring.set(value) → teleport instantly
export function spring(initial: number, cfg: SpringConfig = {}): SpringSignal {
  const stiffness = cfg.stiffness ?? 170;
  const damping   = cfg.damping   ?? 26;
  const precision = cfg.precision ?? 0.005;

  let current  = initial;
  let target   = initial;
  let velocity = 0;
  let rafId    = 0;
  let lastTime = 0;
  let destroyed = false;

  const _sig = signal(initial);

  function tick(time: number): void {
    if (destroyed) return;
    const dt = Math.min((time - lastTime) / 1000, 0.064); // cap at 64ms
    lastTime = time;

    const spring_f = -stiffness * (current - target);
    const damping_f = -damping * velocity;
    const acceleration = spring_f + damping_f;

    velocity += acceleration * dt;
    current  += velocity * dt;

    const atRest = Math.abs(current - target) < precision
                && Math.abs(velocity) < precision;

    if (atRest) {
      current  = target;
      velocity = 0;
      rafId    = 0;
      _sig.set(current);
      return;
    }

    _sig.set(current);
    rafId = requestAnimationFrame(tick);
  }

  const ext: SpringSignal = Object.assign(
    function (): number { return _sig(); },
    {
      peek:      (): number => _sig.peek(),
      subscribe: (fn: SignalSubscriber<number>): Unsubscribe => _sig.subscribe(fn),

      to(targetVal: number): void {
        if (destroyed) return;
        target = targetVal;
        if (!rafId) {
          lastTime = performance.now();
          rafId = requestAnimationFrame(tick);
        }
      },

      set(value: number): void {
        target   = value;
        current  = value;
        velocity = 0;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        _sig.set(value);
      },

      stop(): void {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        velocity = 0;
      },

      destroy(): void {
        destroyed = true;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      },
    },
  );

  return ext;
}

// ── tween() ────────────────────────────────────────────────────────────
// Time-based interpolation: value moves from current to target in fixed duration.
// tween.to(value) → animate  |  tween.set(value) → teleport instantly
export function tween(initial: number, cfg: TweenConfig = {}): TweenSignal {
  const duration = cfg.duration ?? 300;
  const easing   = cfg.easing   ?? Easing.cubicOut;

  let from     = initial;
  let to       = initial;
  let startTime = 0;
  let rafId    = 0;
  let destroyed = false;

  const _sig = signal(initial);

  function tick(time: number): void {
    if (destroyed) return;
    const elapsed = time - startTime;
    const t = Math.min(elapsed / duration, 1);
    const v = from + (to - from) * easing(t);

    _sig.set(v);

    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = 0;
      from  = to;
    }
  }

  const ext: TweenSignal = Object.assign(
    function (): number { return _sig(); },
    {
      peek:      (): number => _sig.peek(),
      subscribe: (fn: SignalSubscriber<number>): Unsubscribe => _sig.subscribe(fn),

      to(target: number): void {
        if (destroyed) return;
        if (rafId) cancelAnimationFrame(rafId);
        from      = _sig.peek();
        to        = target;
        startTime = performance.now();
        rafId     = requestAnimationFrame(tick);
      },

      set(value: number): void {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        from = value;
        to   = value;
        _sig.set(value);
      },

      stop(): void {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        from = _sig.peek();
      },

      destroy(): void {
        destroyed = true;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      },
    },
  );

  return ext;
}

// ── stagger() ──────────────────────────────────────────────────────────
// Returns a delay (ms) for the i-th element in a staggered animation.
export function stagger(i: number, opts: { delay?: number; from?: 'start' | 'center' | 'end'; total?: number } = {}): number {
  const delay = opts.delay ?? 30;
  if (opts.from === 'center' && opts.total !== undefined) {
    const mid = (opts.total - 1) / 2;
    return Math.abs(i - mid) * delay;
  }
  if (opts.from === 'end' && opts.total !== undefined) {
    return (opts.total - 1 - i) * delay;
  }
  return i * delay;
}

// ── interpolate() ──────────────────────────────────────────────────────
// Map a [0,1] progress value through a keyframe sequence.
export function interpolate(
  progress: number,
  keyframes: [at: number, value: number][],
): number {
  const clamped = Math.max(0, Math.min(1, progress));
  for (let i = 0; i < keyframes.length - 1; i++) {
    const [a, va] = keyframes[i]!;
    const [b, vb] = keyframes[i + 1]!;
    if (clamped >= a && clamped <= b) {
      const t = (clamped - a) / (b - a);
      return va + (vb - va) * t;
    }
  }
  return keyframes[keyframes.length - 1]![1];
}
