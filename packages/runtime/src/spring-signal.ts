import { signal } from './signal.js';

export interface SpringOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
  precision?: number;
}

export interface SpringSignal {
  (): number;
  set: (target: number) => void;
  target: () => number;
  velocity: () => number;
  settled: () => boolean;
  stop: () => void;
}

export function springSignal(initial: number, opts?: SpringOptions): SpringSignal {
  const stiffness = opts?.stiffness ?? 170;
  const damping   = opts?.damping   ?? 26;
  const mass      = opts?.mass      ?? 1;
  const precision = opts?.precision ?? 0.01;

  const _current  = signal(initial);
  const _target   = signal(initial);
  const _velocity = signal(0);
  const _settled  = signal(true);

  let current  = initial;
  let target   = initial;
  let velocity = 0;
  let rafId: ReturnType<typeof setTimeout> | number = 0;
  let lastTime = 0;

  const useRAF = typeof requestAnimationFrame !== 'undefined';

  function tick(now: number): void {
    const dt = Math.min((now - lastTime) / 1000, 0.064);
    lastTime = now;

    const acceleration = (stiffness * (target - current) - damping * velocity) / mass;
    velocity += acceleration * dt;
    current  += velocity * dt;

    const atRest = Math.abs(velocity) < precision && Math.abs(target - current) < precision;

    if (atRest) {
      current  = target;
      velocity = 0;
      rafId    = 0;
      _current.set(current);
      _velocity.set(0);
      _settled.set(true);
      return;
    }

    _current.set(current);
    _velocity.set(velocity);

    if (useRAF) {
      rafId = requestAnimationFrame((t) => tick(t));
    } else {
      rafId = setInterval(() => {
        clearInterval(rafId as ReturnType<typeof setInterval>);
        tick(Date.now());
      }, 16);
    }
  }

  function startLoop(): void {
    if (rafId) return;
    _settled.set(false);
    lastTime = useRAF ? performance.now() : Date.now();
    if (useRAF) {
      rafId = requestAnimationFrame((t) => tick(t));
    } else {
      rafId = setInterval(() => {
        clearInterval(rafId as ReturnType<typeof setInterval>);
        tick(Date.now());
      }, 16);
    }
  }

  function stopLoop(): void {
    if (rafId) {
      if (useRAF) {
        cancelAnimationFrame(rafId as number);
      } else {
        clearInterval(rafId as ReturnType<typeof setInterval>);
      }
      rafId = 0;
    }
  }

  const sig = Object.assign(
    function (): number { return _current(); },
    {
      set(newTarget: number): void {
        target = newTarget;
        _target.set(newTarget);
        startLoop();
      },
      target(): number { return _target(); },
      velocity(): number { return _velocity(); },
      settled(): boolean { return _settled(); },
      stop(): void {
        stopLoop();
        velocity = 0;
        _velocity.set(0);
        _settled.set(true);
      },
    },
  ) as SpringSignal;

  return sig;
}

export interface SpringVectorOptions extends SpringOptions {}

export function springVector2D(
  initial: { x: number; y: number },
  opts?: SpringVectorOptions,
): { x: SpringSignal; y: SpringSignal; setXY: (x: number, y: number) => void } {
  const x = springSignal(initial.x, opts);
  const y = springSignal(initial.y, opts);
  return {
    x,
    y,
    setXY(nx: number, ny: number): void {
      x.set(nx);
      y.set(ny);
    },
  };
}
