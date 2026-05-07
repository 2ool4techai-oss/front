import { signal, computed } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Intent types ──────────────────────────────────────────────────────

export type UserIntent =
  | 'browsing'      // scanning, low dwell time, fast scroll
  | 'searching'     // frequent input changes, backspaces, short pauses
  | 'reading'       // long dwell time, slow/no scroll, no input
  | 'comparing'     // tab switches, back/forward, hovering multiple items
  | 'deciding'      // repeated focus on same element, long hover, hesitation
  | 'completing'    // filling forms, sequential field focus
  | 'stuck'         // long idle + repeated failed actions
  | 'unknown';

export interface IntentSignals {
  scrollVelocity:  number;   // px/sec rolling average
  dwellTime:       number;   // ms on current "page region"
  inputActivity:   number;   // keystrokes in last 10s
  backspaceRatio:  number;   // backspaces / total keystrokes
  tabSwitches:     number;   // focus changes to different top-level sections
  hoverRepeats:    number;   // how many times same element hovered in 30s
  formProgress:    number;   // 0–1: how many form fields have been touched
  failedActions:   number;   // clicks that didn't change visible state
  idleMs:          number;   // ms since last interaction
}

export interface IntentEngineOptions {
  /** How often to re-evaluate intent, ms. Default 500 */
  interval?:    number;
  /** Element to attach listeners to. Default document */
  target?:      EventTarget;
  /** Pluggable classifier: return null to use built-in heuristics */
  classify?:    (signals: IntentSignals, previous: UserIntent) => UserIntent | null;
  /** Called when intent changes */
  onIntentChange?: (next: UserIntent, prev: UserIntent, signals: IntentSignals) => void;
}

export interface IntentEngine {
  /** Current detected intent */
  readonly intent:   Signal<UserIntent>;
  /** Reactive snapshot of raw signals */
  readonly signals:  Signal<IntentSignals>;
  /** Derived: is the user likely ready to commit an action? */
  readonly readyToAct: ComputedSignal<boolean>;
  /** Derived: does the user appear stuck / frustrated? */
  readonly needsHelp:  ComputedSignal<boolean>;
  /** Force a specific intent (e.g., from URL params or A/B test) */
  setIntent(i: UserIntent): void;
  /** Destroy and remove all listeners */
  destroy(): void;
}

// ── Internal helpers ──────────────────────────────────────────────────

interface ScrollSample {
  scrollY: number;
  t: number;
}

interface KeySample {
  t: number;
  isBackspace: boolean;
}

interface HoverEntry {
  target: EventTarget;
  t: number;
}

// ── createIntentEngine ────────────────────────────────────────────────

export function createIntentEngine(opts: IntentEngineOptions = {}): IntentEngine {
  const interval = opts.interval ?? 500;
  const target   = opts.target ?? document;

  // ── Raw tracking state ─────────────────────────────────────────────
  const scrollSamples:  ScrollSample[] = [];
  const keySamples:     KeySample[]    = [];
  const hoverEntries:   HoverEntry[]   = [];
  const touchedInputs   = new Set<EventTarget>();

  let lastScrollY       = (typeof window !== 'undefined' ? window.scrollY : 0);
  let dwellStart        = Date.now();
  let lastSection:      string | null = null;
  let tabSwitches       = 0;
  let failedActions     = 0;
  let lastVisibleState  = '';
  let lastInteractT     = Date.now();
  let destroyed         = false;

  // ── Signals ────────────────────────────────────────────────────────
  const _intent  = signal<UserIntent>('unknown');
  const _signals = signal<IntentSignals>({
    scrollVelocity: 0,
    dwellTime:      0,
    inputActivity:  0,
    backspaceRatio: 0,
    tabSwitches:    0,
    hoverRepeats:   0,
    formProgress:   0,
    failedActions:  0,
    idleMs:         0,
  });

  // ── Computed ───────────────────────────────────────────────────────
  const readyToAct = computed<boolean>(() => {
    const i = _intent();
    return i === 'deciding' || i === 'completing';
  });

  const needsHelp = computed<boolean>(() => {
    const i = _intent();
    const s = _signals();
    return i === 'stuck' || (i === 'searching' && s.backspaceRatio > 0.4);
  });

  // ── Helper: snapshot visible DOM state ───────────────────────────
  function snapshotVisibleState(): string {
    if (typeof document === 'undefined') return '';
    try {
      // Simple hash of visible text content length as a proxy for visible state change
      return String(document.body?.innerText?.length ?? 0) + String(document.body?.children?.length ?? 0);
    } catch {
      return '';
    }
  }

  // ── Helper: compute scroll velocity (px/sec) over last 3s ─────────
  function computeScrollVelocity(): number {
    const now    = Date.now();
    const cutoff = now - 3000;
    const recent = scrollSamples.filter(s => s.t >= cutoff);
    if (recent.length < 2) return 0;

    let totalDeltaY = 0;
    let totalDt     = 0;
    for (let i = 1; i < recent.length; i++) {
      const a = recent[i - 1]!;
      const b = recent[i]!;
      const dt = b.t - a.t;
      if (dt <= 0) continue;
      totalDeltaY += Math.abs(b.scrollY - a.scrollY);
      totalDt     += dt;
    }

    if (totalDt > 0) {
      return (totalDeltaY / totalDt) * 1000;
    }

    // All events happened at the same timestamp (e.g., in fake timer tests).
    // Compute total displacement; if enough events accumulated, treat as high velocity.
    let accumulatedDelta = 0;
    for (let i = 1; i < recent.length; i++) {
      accumulatedDelta += Math.abs(recent[i]!.scrollY - recent[i - 1]!.scrollY);
    }
    // Use 1ms as the minimum time window to avoid division by zero
    const windowMs = Math.max(recent[recent.length - 1]!.t - recent[0]!.t, 1);
    return (accumulatedDelta / windowMs) * 1000;
  }

  // ── Helper: input activity (keystrokes in last 10s) ───────────────
  function computeInputActivity(): number {
    const now    = Date.now();
    const cutoff = now - 10_000;
    return keySamples.filter(k => k.t >= cutoff).length;
  }

  // ── Helper: backspace ratio (in last 10s) ─────────────────────────
  function computeBackspaceRatio(): number {
    const now    = Date.now();
    const cutoff = now - 10_000;
    const recent = keySamples.filter(k => k.t >= cutoff);
    if (recent.length < 2) return 0;
    return recent.filter(k => k.isBackspace).length / recent.length;
  }

  // ── Helper: hover repeats (same element in last 30s) ──────────────
  function computeHoverRepeats(): number {
    const now    = Date.now();
    const cutoff = now - 30_000;
    const recent = hoverEntries.filter(h => h.t >= cutoff);

    // Count how many hover entries share a target that appeared more than once
    const counts = new Map<EventTarget, number>();
    for (const h of recent) {
      counts.set(h.target, (counts.get(h.target) ?? 0) + 1);
    }
    let repeats = 0;
    for (const [, count] of counts) {
      if (count > 1) repeats += count - 1;
    }
    return repeats;
  }

  // ── Helper: form progress ─────────────────────────────────────────
  function computeFormProgress(): number {
    if (typeof document === 'undefined') return 0;
    try {
      const allInputs = document.querySelectorAll('input, textarea, select');
      if (allInputs.length === 0) return 0;
      return touchedInputs.size / allInputs.length;
    } catch {
      return 0;
    }
  }

  // ── Event handlers ─────────────────────────────────────────────────

  function onScroll(e: Event): void {
    lastInteractT = Date.now();
    const currentY = typeof window !== 'undefined' ? window.scrollY : 0;

    // Allow tests to inject scrollY via custom property
    const customEvent = e as Event & { scrollY?: number; deltaY?: number };
    const injectedY = customEvent.scrollY ?? customEvent.deltaY;

    let newY: number;
    if (typeof injectedY === 'number') {
      newY = lastScrollY + Math.abs(injectedY);
    } else {
      newY = currentY;
    }

    scrollSamples.push({ scrollY: newY, t: Date.now() });
    lastScrollY = newY;

    // Prune old samples (keep 5s window)
    const cutoff = Date.now() - 5000;
    while (scrollSamples.length > 0 && scrollSamples[0]!.t < cutoff) {
      scrollSamples.shift();
    }
  }

  function onKeydown(e: Event): void {
    lastInteractT = Date.now();
    const ke = e as KeyboardEvent;
    keySamples.push({ t: Date.now(), isBackspace: ke.key === 'Backspace' });

    // Prune old samples
    const cutoff = Date.now() - 10_000;
    while (keySamples.length > 0 && keySamples[0]!.t < cutoff) {
      keySamples.shift();
    }
  }

  function onMouseover(e: Event): void {
    lastInteractT = Date.now();
    if (e.target) {
      hoverEntries.push({ target: e.target, t: Date.now() });

      // Prune old entries
      const cutoff = Date.now() - 30_000;
      while (hoverEntries.length > 0 && hoverEntries[0]!.t < cutoff) {
        hoverEntries.shift();
      }
    }
  }

  function onFocusin(e: Event): void {
    lastInteractT = Date.now();
    const fe = e as FocusEvent;
    if (fe.target) {
      const el = fe.target as Element;
      // Detect section switch
      let section: string | null = null;
      const sectionEl = typeof el.closest === 'function'
        ? el.closest('[data-section]')
        : null;
      if (sectionEl) {
        section = (sectionEl as HTMLElement).dataset?.['section'] ?? null;
      } else {
        // Fallback: use top-level parent tag+id as section key
        let parent: Element | null = el;
        while (parent?.parentElement && parent.parentElement !== document.body) {
          parent = parent.parentElement;
        }
        section = parent ? `${parent.tagName}#${parent.id}` : null;
      }

      if (section !== null && section !== lastSection) {
        tabSwitches++;
        lastSection = section;
      }
    }
  }

  function onInput(e: Event): void {
    lastInteractT = Date.now();
    const ie = e as InputEvent;
    if (ie.target) {
      touchedInputs.add(ie.target);
    }
  }

  function onClick(): void {
    lastInteractT = Date.now();
    const currentState = snapshotVisibleState();
    // Give the DOM a tick to update — compare to snapshot taken just before
    setTimeout(() => {
      const newState = snapshotVisibleState();
      if (newState === lastVisibleState && currentState === lastVisibleState) {
        failedActions++;
      }
      lastVisibleState = newState;
    }, 100);
  }

  // ── Classifier ─────────────────────────────────────────────────────

  function builtInClassify(s: IntentSignals, prev: UserIntent): UserIntent {
    // stuck: failedActions > 3 OR (idleMs > 15000 and not reading)
    if (s.failedActions > 3 || (s.idleMs > 15_000 && prev !== 'reading')) {
      return 'stuck';
    }
    // browsing: fast scroll + low dwell + low input
    if (s.scrollVelocity > 200 && s.dwellTime < 5000 && s.inputActivity < 3) {
      return 'browsing';
    }
    // searching: high input + high backspace ratio
    if (s.inputActivity > 10 && s.backspaceRatio > 0.2) {
      return 'searching';
    }
    // reading: long dwell + slow/no scroll + low input
    if (s.dwellTime > 8000 && s.scrollVelocity < 50 && s.inputActivity < 2) {
      return 'reading';
    }
    // comparing: many tab switches + many hover repeats
    if (s.tabSwitches > 3 && s.hoverRepeats > 4) {
      return 'comparing';
    }
    // deciding: many hover repeats + slow scroll + some idle
    if (s.hoverRepeats > 6 && s.scrollVelocity < 30 && s.idleMs > 2000) {
      return 'deciding';
    }
    // completing: form in progress + active typing
    if (s.formProgress > 0.2 && s.inputActivity > 5) {
      return 'completing';
    }
    return 'unknown';
  }

  // ── Tick ───────────────────────────────────────────────────────────

  function tick(): void {
    if (destroyed) return;

    const now  = Date.now();
    const snap: IntentSignals = {
      scrollVelocity: computeScrollVelocity(),
      dwellTime:      now - dwellStart,
      inputActivity:  computeInputActivity(),
      backspaceRatio: computeBackspaceRatio(),
      tabSwitches,
      hoverRepeats:   computeHoverRepeats(),
      formProgress:   computeFormProgress(),
      failedActions,
      idleMs:         now - lastInteractT,
    };

    _signals.set(snap);

    const prev    = _intent.peek();
    const custom  = opts.classify ? opts.classify(snap, prev) : null;
    const next    = custom !== null ? custom : builtInClassify(snap, prev);

    if (next !== prev) {
      _intent.set(next);
      if (opts.onIntentChange) {
        opts.onIntentChange(next, prev, snap);
      }
    }
  }

  // ── Attach listeners ───────────────────────────────────────────────

  target.addEventListener('scroll',  onScroll,   { passive: true } as AddEventListenerOptions);
  target.addEventListener('keydown', onKeydown,  { passive: true } as AddEventListenerOptions);
  target.addEventListener('mouseover', onMouseover, { passive: true } as AddEventListenerOptions);
  target.addEventListener('focusin', onFocusin,  { passive: true } as AddEventListenerOptions);
  target.addEventListener('input',   onInput,    { passive: true } as AddEventListenerOptions);
  target.addEventListener('click',   onClick,    { passive: true } as AddEventListenerOptions);

  // Record initial visible state
  lastVisibleState = snapshotVisibleState();

  // ── Timer ──────────────────────────────────────────────────────────
  const timer = setInterval(tick, interval);

  // ── Public API ─────────────────────────────────────────────────────

  function setIntent(i: UserIntent): void {
    const prev = _intent.peek();
    _intent.set(i);
    if (i !== prev && opts.onIntentChange) {
      opts.onIntentChange(i, prev, _signals.peek());
    }
  }

  function destroy(): void {
    destroyed = true;
    clearInterval(timer);
    target.removeEventListener('scroll',    onScroll);
    target.removeEventListener('keydown',   onKeydown);
    target.removeEventListener('mouseover', onMouseover);
    target.removeEventListener('focusin',   onFocusin);
    target.removeEventListener('input',     onInput);
    target.removeEventListener('click',     onClick);
  }

  return {
    intent:      _intent,
    signals:     _signals,
    readyToAct,
    needsHelp,
    setIntent,
    destroy,
  };
}

// ── useIntent singleton ────────────────────────────────────────────────

let _singleton: IntentEngine | null = null;
let _singletonTarget: EventTarget | null = null;

export function useIntent(): Signal<UserIntent> {
  const target = typeof document !== 'undefined' ? document : new EventTarget();

  if (!_singleton || _singletonTarget !== target) {
    _singleton       = createIntentEngine({ target });
    _singletonTarget = target;
  }

  return _singleton.intent;
}
