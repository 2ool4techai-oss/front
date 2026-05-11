import { _setSignalWriteHook } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type ReplayEventType =
  | 'signal-change'
  | 'click'
  | 'input'
  | 'scroll'
  | 'navigation'
  | 'error';

export interface ReplayEvent {
  type:      ReplayEventType;
  timestamp: number;
  data:      Record<string, unknown>;
}

export interface ReplayOptions {
  maxEvents?:     number;
  captureDOM?:    boolean;
  onFlush?:       (events: ReplayEvent[]) => void;
  flushInterval?: number;
  sampleRate?:    number;
}

export interface ReplayHandle {
  readonly events: readonly ReplayEvent[];
  readonly size:   number;
  start(): void;
  stop(): void;
  flush(): void;
  clear(): void;
  export(): string;
}

// ── createSessionReplay ────────────────────────────────────────────────

export function createSessionReplay(opts?: ReplayOptions): ReplayHandle {
  const maxEvents     = opts?.maxEvents     ?? 1000;
  const sampleRate    = opts?.sampleRate    ?? 1;
  const flushInterval = opts?.flushInterval ?? 30000;

  const _events: ReplayEvent[] = [];
  let running       = false;
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  // DOM event listeners
  const _listeners: Array<{
    target: EventTarget;
    type: string;
    fn: EventListener;
    opts?: AddEventListenerOptions;
  }> = [];

  function pushEvent(ev: ReplayEvent): void {
    _events.push(ev);
    while (_events.length > maxEvents) {
      _events.shift();
    }
  }

  function shouldCapture(): boolean {
    return sampleRate >= 1 || Math.random() <= sampleRate;
  }

  function handleClick(e: Event): void {
    if (!running || !shouldCapture()) return;
    const me = e as MouseEvent;
    const el = e.target as HTMLElement | null;
    const target = el
      ? el.tagName + (el.id ? '#' + el.id : '')
      : '';
    pushEvent({
      type:      'click',
      timestamp: Date.now(),
      data:      { target, x: me.clientX, y: me.clientY },
    });
  }

  function handleInput(e: Event): void {
    if (!running || !shouldCapture()) return;
    const el = e.target as HTMLInputElement | null;
    pushEvent({
      type:      'input',
      timestamp: Date.now(),
      data:      { target: el ? el.tagName + (el.id ? '#' + el.id : '') : '' },
    });
  }

  function handleScroll(e: Event): void {
    if (!running || !shouldCapture()) return;
    const el = e.target as HTMLElement | null;
    pushEvent({
      type:      'scroll',
      timestamp: Date.now(),
      data:      {
        scrollTop:  el instanceof HTMLElement ? el.scrollTop : 0,
        scrollLeft: el instanceof HTMLElement ? el.scrollLeft : 0,
      },
    });
  }

  function signalWriteHook(
    _sig: Signal<unknown>,
    lbl: string,
    prev: unknown,
    next: unknown,
  ): void {
    if (!running) return;
    pushEvent({
      type:      'signal-change',
      timestamp: Date.now(),
      data:      { label: lbl, prev: String(prev), next: String(next) },
    });
  }

  function start(): void {
    if (running) return;
    running = true;

    if (typeof document !== 'undefined') {
      const clickFn  = handleClick  as EventListener;
      const inputFn  = handleInput  as EventListener;
      const scrollFn = handleScroll as EventListener;

      document.addEventListener('click',  clickFn,  { passive: true } as AddEventListenerOptions);
      document.addEventListener('input',  inputFn,  { passive: true } as AddEventListenerOptions);
      document.addEventListener('scroll', scrollFn, { passive: true, capture: true } as AddEventListenerOptions);

      _listeners.push(
        { target: document, type: 'click',  fn: clickFn,  opts: { passive: true } },
        { target: document, type: 'input',  fn: inputFn,  opts: { passive: true } },
        { target: document, type: 'scroll', fn: scrollFn, opts: { passive: true, capture: true } },
      );
    }

    _setSignalWriteHook(signalWriteHook);

    if (opts?.onFlush && typeof setInterval !== 'undefined') {
      flushTimer = setInterval(() => {
        flush();
      }, flushInterval);
    }
  }

  function stop(): void {
    if (!running) return;
    running = false;

    for (const { target, type, fn, opts: evOpts } of _listeners) {
      target.removeEventListener(type, fn, evOpts);
    }
    _listeners.length = 0;

    _setSignalWriteHook(null);

    if (flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  function flush(): void {
    if (opts?.onFlush) {
      opts.onFlush([..._events]);
      _events.length = 0;
    }
  }

  function clear(): void {
    _events.length = 0;
  }

  function exportEvents(): string {
    return JSON.stringify(_events);
  }

  return {
    get events(): readonly ReplayEvent[] { return _events; },
    get size(): number { return _events.length; },
    start,
    stop,
    flush,
    clear,
    export: exportEvents,
  };
}
