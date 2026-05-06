import { signal } from './signal.js';
import type { EmotionState, Signal } from './types.js';

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

const SAMPLE_WINDOW = 1000;
const IDLE_THRESHOLD_MS = 5000;
const TICK_INTERVAL_MS = 500;        // classify every 500ms, not every frame
const FRUSTRATION_VELOCITY = 700;
const FRUSTRATION_CLICKS = 4;
const CONFUSION_PAUSES = 3;
const ENGAGED_VELOCITY_MIN = 60;
const ENGAGED_VELOCITY_MAX = 500;
const MAX_SAMPLES = 30;              // cap buffer size

export class EmotionProcessor {
  private readonly _state: Signal<EmotionState>;
  private _samples: PointerSample[] = [];
  private _clicks: number[] = [];
  private _scrollSamples: number[] = [];
  private _lastScrollY = 0;
  private _lastMoveT = Date.now();
  private _timer = 0;
  private _el: Element;
  private _onPointer: (e: PointerEvent) => void;
  private _onClick: () => void;
  private _onScroll: () => void;

  constructor(el: Element) {
    this._el = el;
    this._state = signal<EmotionState>('calm');

    this._onPointer = (e: PointerEvent) => {
      const now = performance.now();
      this._lastMoveT = Date.now();
      this._samples.push({ x: e.clientX, y: e.clientY, t: now });
      if (this._samples.length > MAX_SAMPLES) this._samples.shift();
    };

    this._onClick = () => {
      const now = Date.now();
      this._clicks.push(now);
      // keep only clicks in last 3 seconds
      this._clicks = this._clicks.filter(t => now - t < 3000);
    };

    this._onScroll = () => {
      const dy = Math.abs(window.scrollY - this._lastScrollY);
      this._lastScrollY = window.scrollY;
      this._scrollSamples.push(dy);
      if (this._scrollSamples.length > 15) this._scrollSamples.shift();
    };

    el.addEventListener('pointermove', this._onPointer as EventListener, { passive: true });
    el.addEventListener('click', this._onClick, { passive: true });
    window.addEventListener('scroll', this._onScroll, { passive: true });

    // Use setInterval instead of rAF — far less CPU pressure
    this._timer = window.setInterval(this._tick.bind(this), TICK_INTERVAL_MS);
  }

  get state(): Signal<EmotionState> { return this._state; }

  private _velocity(): number {
    const now = performance.now();
    const cutoff = now - SAMPLE_WINDOW;
    const recent = this._samples.filter(s => s.t >= cutoff);
    if (recent.length < 2) return 0;

    let totalDist = 0, totalTime = 0;
    for (let i = 1; i < recent.length; i++) {
      const a = recent[i - 1]!;
      const b = recent[i]!;
      const dt = b.t - a.t;
      if (dt <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      totalDist += Math.sqrt(dx * dx + dy * dy);
      totalTime += dt;
    }
    return totalTime > 0 ? (totalDist / totalTime) * 1000 : 0;
  }

  private _pauseCount(): number {
    let pauses = 0;
    for (let i = 1; i < this._samples.length; i++) {
      const a = this._samples[i - 1]!;
      const b = this._samples[i]!;
      const dt = b.t - a.t;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dt > 500 && Math.sqrt(dx * dx + dy * dy) < 8) pauses++;
    }
    return pauses;
  }

  private _classify(): EmotionState {
    const idleMs = Date.now() - this._lastMoveT;
    if (idleMs > IDLE_THRESHOLD_MS) return 'calm';

    const v = this._velocity();
    const clicks = this._clicks.length;
    const pauses = this._pauseCount();

    if (clicks >= FRUSTRATION_CLICKS || v > FRUSTRATION_VELOCITY) return 'frustrated';
    if (pauses >= CONFUSION_PAUSES) return 'confused';
    if (v >= ENGAGED_VELOCITY_MIN && v <= ENGAGED_VELOCITY_MAX) return 'engaged';
    return 'calm';
  }

  private _tick(): void {
    const next = this._classify();
    if (next !== this._state.peek()) this._state.set(next);
  }

  celebrate(): void {
    this._state.set('celebrating');
    setTimeout(() => {
      if (this._state.peek() === 'celebrating') this._state.set('calm');
    }, 3000);
  }

  destroy(): void {
    clearInterval(this._timer);
    this._el.removeEventListener('pointermove', this._onPointer as EventListener);
    this._el.removeEventListener('click', this._onClick);
    window.removeEventListener('scroll', this._onScroll);
  }
}
