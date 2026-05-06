import { signal } from './signal.js';
import type { EmotionState, Signal } from './types.js';

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

interface KeySample {
  t: number;
  isBackspace: boolean;
}

export interface EmotionSnapshot {
  state: EmotionState;
  confidence: number;          // 0–1
  velocity: number;            // px/s mouse speed
  clickRate: number;           // clicks/sec in last 3s
  keystrokeRate: number;       // keys/sec in last 5s
  backspaceRatio: number;      // backspaces / total keys (confusion proxy)
  idleMs: number;              // ms since last interaction
  history: EmotionState[];     // last 8 transitions
}

// ── Constants ──────────────────────────────────────────────────────────
const SAMPLE_WINDOW_MS  = 1200;
const IDLE_THRESHOLD_MS = 6000;
const BORED_IDLE_MS     = 12_000;
const TICK_INTERVAL_MS  = 500;
const MAX_SAMPLES       = 40;
const MAX_KEY_SAMPLES   = 30;
const HISTORY_LEN       = 8;

// Velocity thresholds (px/s)
const V_FRUSTRATED = 650;
const V_ENGAGED_LO = 55;
const V_ENGAGED_HI = 480;
const V_FOCUSED_HI = 120;   // low but steady → focused

// Click thresholds (clicks in 3s window)
const CLICKS_FRUSTRATED = 4;
const CLICKS_CELEBRATING = 1; // single intentional click after success — context from outside

// Keyboard thresholds
const KPM_FOCUSED = 1.5;     // keys/sec steady → focused
const BACKSPACE_CONFUSED = 0.35; // >35% backspaces → confused/frustrated

export class EmotionProcessor {
  private readonly _state:    Signal<EmotionState>;
  private readonly _snapshot: Signal<EmotionSnapshot>;

  private _samples:      PointerSample[] = [];
  private _clicks:       number[] = [];
  private _keySamples:   KeySample[] = [];
  private _pauseCount_:  number = 0;
  private _lastMoveT:    number = Date.now();
  private _lastInteractT:number = Date.now();
  private _timer:        number = 0;
  private _history:      EmotionState[] = [];
  private _destroyed:    boolean = false;

  private _el: Element;
  private _boundPointer: (e: PointerEvent) => void;
  private _boundClick:   () => void;
  private _boundScroll:  () => void;
  private _boundKeydown: (e: KeyboardEvent) => void;

  constructor(el: Element) {
    this._el = el;

    const initial = this._emptySnapshot('calm', 1);
    this._state    = signal<EmotionState>('calm');
    this._snapshot = signal<EmotionSnapshot>(initial);

    this._boundPointer = (e: PointerEvent) => {
      const now = performance.now();
      this._lastMoveT    = Date.now();
      this._lastInteractT= Date.now();
      this._samples.push({ x: e.clientX, y: e.clientY, t: now });
      if (this._samples.length > MAX_SAMPLES) this._samples.shift();
    };

    this._boundClick = () => {
      const now = Date.now();
      this._lastInteractT = now;
      this._clicks.push(now);
      this._clicks = this._clicks.filter(t => now - t < 3000);
    };

    this._boundScroll = () => {
      this._lastInteractT = Date.now();
    };

    this._boundKeydown = (e: KeyboardEvent) => {
      const now = Date.now();
      this._lastInteractT = now;
      this._keySamples.push({ t: now, isBackspace: e.key === 'Backspace' });
      if (this._keySamples.length > MAX_KEY_SAMPLES) this._keySamples.shift();
    };

    el.addEventListener('pointermove', this._boundPointer as EventListener, { passive: true });
    el.addEventListener('click',       this._boundClick,                     { passive: true });
    window.addEventListener('scroll',  this._boundScroll,                    { passive: true });
    window.addEventListener('keydown', this._boundKeydown,                   { passive: true });

    this._timer = window.setInterval(() => this._tick(), TICK_INTERVAL_MS);
  }

  get state():    Signal<EmotionState>    { return this._state; }
  get snapshot(): Signal<EmotionSnapshot> { return this._snapshot; }

  // ── Public helpers ───────────────────────────────────────────────────

  celebrate(): void {
    this._transition('celebrating');
    setTimeout(() => {
      if (this._state.peek() === 'celebrating') this._transition('calm');
    }, 3000);
  }

  destroy(): void {
    this._destroyed = true;
    clearInterval(this._timer);
    this._el.removeEventListener('pointermove', this._boundPointer as EventListener);
    this._el.removeEventListener('click',       this._boundClick);
    window.removeEventListener('scroll',        this._boundScroll);
    window.removeEventListener('keydown',       this._boundKeydown);
  }

  // ── Internal ─────────────────────────────────────────────────────────

  private _velocity(): number {
    const now    = performance.now();
    const cutoff = now - SAMPLE_WINDOW_MS;
    const recent = this._samples.filter(s => s.t >= cutoff);
    if (recent.length < 2) return 0;

    let dist = 0, time = 0;
    for (let i = 1; i < recent.length; i++) {
      const a = recent[i - 1]!;
      const b = recent[i]!;
      const dt = b.t - a.t;
      if (dt <= 0) continue;
      dist += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
      time += dt;
    }
    return time > 0 ? (dist / time) * 1000 : 0;
  }

  private _keystrokeRate(): number {
    const now    = Date.now();
    const window = 5000;
    const recent = this._keySamples.filter(k => now - k.t < window);
    return recent.length / (window / 1000);
  }

  private _backspaceRatio(): number {
    if (this._keySamples.length < 4) return 0;
    const now    = Date.now();
    const recent = this._keySamples.filter(k => now - k.t < 8000);
    if (recent.length < 3) return 0;
    return recent.filter(k => k.isBackspace).length / recent.length;
  }

  private _pauseCount(): number {
    let pauses = 0;
    for (let i = 1; i < this._samples.length; i++) {
      const a = this._samples[i - 1]!;
      const b = this._samples[i]!;
      if (b.t - a.t > 500 && Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) < 8) pauses++;
    }
    return pauses;
  }

  private _classify(): { state: EmotionState; confidence: number } {
    const idleMs    = Date.now() - this._lastInteractT;
    const v         = this._velocity();
    const clicks    = this._clicks.length;
    const kpm       = this._keystrokeRate();
    const bsRatio   = this._backspaceRatio();
    const pauses    = this._pauseCount();

    // Bored — very long idle
    if (idleMs > BORED_IDLE_MS) return { state: 'bored', confidence: Math.min(1, (idleMs - BORED_IDLE_MS) / 10_000) };

    // Calm — idle but not bored
    if (idleMs > IDLE_THRESHOLD_MS) return { state: 'calm', confidence: 0.9 };

    // Frustrated — rapid erratic movement or rage-clicks
    if (clicks >= CLICKS_FRUSTRATED || v > V_FRUSTRATED) {
      const conf = Math.min(1, clicks / CLICKS_FRUSTRATED + (v - V_FRUSTRATED) / 500);
      return { state: 'frustrated', confidence: Math.max(0.5, conf) };
    }

    // Confused — many pauses OR high backspace ratio
    if (pauses >= 3 || bsRatio >= BACKSPACE_CONFUSED) {
      const conf = Math.min(1, pauses / 5 + bsRatio / 0.5);
      return { state: 'confused', confidence: Math.max(0.4, conf) };
    }

    // Focused — steady typing, slow mouse
    if (kpm >= KPM_FOCUSED && v < V_FOCUSED_HI) {
      return { state: 'focused', confidence: Math.min(1, kpm / 4) };
    }

    // Engaged — purposeful movement
    if (v >= V_ENGAGED_LO && v <= V_ENGAGED_HI) {
      const conf = 1 - Math.abs(v - (V_ENGAGED_LO + V_ENGAGED_HI) / 2) / (V_ENGAGED_HI - V_ENGAGED_LO);
      return { state: 'engaged', confidence: Math.max(0.5, conf) };
    }

    return { state: 'calm', confidence: 0.7 };
  }

  private _tick(): void {
    if (this._destroyed) return;
    const { state, confidence } = this._classify();

    const snap: EmotionSnapshot = {
      state,
      confidence,
      velocity:       this._velocity(),
      clickRate:      this._clicks.length / 3,
      keystrokeRate:  this._keystrokeRate(),
      backspaceRatio: this._backspaceRatio(),
      idleMs:         Date.now() - this._lastInteractT,
      history:        [...this._history],
    };
    this._snapshot.set(snap);

    if (state !== this._state.peek()) this._transition(state);
  }

  private _transition(next: EmotionState): void {
    this._history.push(this._state.peek());
    if (this._history.length > HISTORY_LEN) this._history.shift();
    this._state.set(next);
  }

  private _emptySnapshot(state: EmotionState, confidence: number): EmotionSnapshot {
    return { state, confidence, velocity: 0, clickRate: 0, keystrokeRate: 0, backspaceRatio: 0, idleMs: 0, history: [] };
  }
}
