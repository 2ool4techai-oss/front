import { signal } from './signal.js';
import type { EmotionState, Signal } from './types.js';

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

interface EmotionMetrics {
  avgVelocity: number;
  pauseCount: number;
  clickRate: number;
  scrollJerk: number;
  idleMs: number;
}

const SAMPLE_WINDOW = 800;
const IDLE_THRESHOLD_MS = 4000;
const FRUSTRATION_VELOCITY = 900;
const FRUSTRATION_CLICKS = 4;
const CONFUSION_PAUSES = 5;
const ENGAGED_VELOCITY_MIN = 80;
const ENGAGED_VELOCITY_MAX = 500;

export class EmotionProcessor {
  private readonly _state: Signal<EmotionState>;
  private _samples: PointerSample[] = [];
  private _clicks: number[] = [];
  private _scrollY = 0;
  private _lastScrollY = 0;
  private _scrollSamples: number[] = [];
  private _lastMoveT = Date.now();
  private _rafId = 0;
  private _el: Element;
  private _onPointer: (e: PointerEvent) => void;
  private _onClick: () => void;
  private _onScroll: () => void;

  constructor(el: Element) {
    this._el = el;
    this._state = signal<EmotionState>('calm');

    this._onPointer = (e: PointerEvent) => {
      const now = performance.now();
      this._samples.push({ x: e.clientX, y: e.clientY, t: now });
      this._lastMoveT = Date.now();
      this._prune(now);
    };

    this._onClick = () => {
      this._clicks.push(Date.now());
      this._clicks = this._clicks.filter(t => Date.now() - t < 2000);
    };

    this._onScroll = () => {
      const dy = window.scrollY - this._lastScrollY;
      this._scrollSamples.push(Math.abs(dy));
      if (this._scrollSamples.length > 20) this._scrollSamples.shift();
      this._lastScrollY = window.scrollY;
    };

    el.addEventListener('pointermove', this._onPointer as EventListener, { passive: true });
    el.addEventListener('click', this._onClick, { passive: true });
    window.addEventListener('scroll', this._onScroll, { passive: true });

    this._rafId = requestAnimationFrame(this._tick.bind(this));
  }

  get state(): Signal<EmotionState> { return this._state; }

  private _prune(now: number): void {
    const cutoff = now - SAMPLE_WINDOW;
    let i = 0;
    while (i < this._samples.length && (this._samples[i]?.t ?? 0) < cutoff) i++;
    if (i > 0) this._samples = this._samples.slice(i);
  }

  private _metrics(): EmotionMetrics {
    const now = performance.now();
    this._prune(now);

    let totalDist = 0;
    let totalTime = 0;
    let pauseCount = 0;

    for (let i = 1; i < this._samples.length; i++) {
      const a = this._samples[i - 1]!;
      const b = this._samples[i]!;
      const dt = b.t - a.t;
      if (dt <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      totalDist += dist;
      totalTime += dt;
      if (dt > 400 && dist < 5) pauseCount++;
    }

    const avgVelocity = totalTime > 0 ? (totalDist / totalTime) * 1000 : 0;
    const clickRate = this._clicks.length;

    const scrollJerk = this._scrollSamples.length > 2
      ? this._scrollSamples.reduce((a, b) => a + b, 0) / this._scrollSamples.length
      : 0;

    const idleMs = Date.now() - this._lastMoveT;

    return { avgVelocity, pauseCount, clickRate, scrollJerk, idleMs };
  }

  private _classify(m: EmotionMetrics): EmotionState {
    if (m.idleMs > IDLE_THRESHOLD_MS) return 'calm';
    if (m.clickRate >= FRUSTRATION_CLICKS || m.avgVelocity > FRUSTRATION_VELOCITY) return 'frustrated';
    if (m.pauseCount >= CONFUSION_PAUSES) return 'confused';
    if (m.avgVelocity >= ENGAGED_VELOCITY_MIN && m.avgVelocity <= ENGAGED_VELOCITY_MAX && m.scrollJerk < 80) return 'engaged';
    return 'calm';
  }

  private _tick(): void {
    const m = this._metrics();
    const next = this._classify(m);
    const current = this._state.peek();
    if (next !== current) this._state.set(next);
    this._rafId = requestAnimationFrame(this._tick.bind(this));
  }

  celebrate(): void {
    this._state.set('celebrating');
    setTimeout(() => {
      if (this._state.peek() === 'celebrating') this._state.set('calm');
    }, 3000);
  }

  destroy(): void {
    cancelAnimationFrame(this._rafId);
    this._el.removeEventListener('pointermove', this._onPointer as EventListener);
    this._el.removeEventListener('click', this._onClick);
    window.removeEventListener('scroll', this._onScroll);
  }
}
