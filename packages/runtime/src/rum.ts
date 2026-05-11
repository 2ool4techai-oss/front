import type { Signal } from './types.js';
import { signal } from './signal.js';

export interface WebVitals {
  lcp:  number | null;
  fid:  number | null;
  cls:  number | null;
  fcp:  number | null;
  ttfb: number | null;
}

export interface RUMOptions {
  endpoint?:      string;
  appName?:       string;
  appVersion?:    string;
  sampleRate?:    number;
  onVitals?:      (vitals: WebVitals) => void;
  onError?:       (err: ErrorEvent) => void;
  flushInterval?: number;
}

export interface RUMHandle {
  readonly vitals:    Signal<WebVitals>;
  readonly errors:    Signal<ErrorEvent[]>;
  readonly pageViews: Signal<number>;
  flush():  void;
  destroy(): void;
}

// Module-level page view counter
let _pageViewCount = 0;

export function createRUM(opts?: RUMOptions): RUMHandle {
  _pageViewCount += 1;

  const vitals = signal<WebVitals>({
    lcp:  null,
    fid:  null,
    cls:  null,
    fcp:  null,
    ttfb: null,
  });
  const errors    = signal<ErrorEvent[]>([]);
  const pageViews = signal<number>(_pageViewCount);

  let clsAccum = 0;
  const observers: PerformanceObserver[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  function updateVitals(patch: Partial<WebVitals>): void {
    const current = vitals.peek();
    vitals.set({ ...current, ...patch });
    opts?.onVitals?.(vitals.peek());
  }

  // LCP
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        if (last) updateVitals({ lcp: last.startTime });
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(lcpObs);
    }
  } catch { /* unsupported */ }

  // FCP
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const fcpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            updateVitals({ fcp: entry.startTime });
          }
        }
      });
      fcpObs.observe({ type: 'paint', buffered: true });
      observers.push(fcpObs);
    }
  } catch { /* unsupported */ }

  // CLS
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const lsEntry = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!lsEntry.hadRecentInput) {
            clsAccum += lsEntry.value;
            updateVitals({ cls: clsAccum });
          }
        }
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
      observers.push(clsObs);
    }
  } catch { /* unsupported */ }

  // FID
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const fidObs = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0] as PerformanceEntry & { processingStart: number; startTime: number };
        if (entry) {
          updateVitals({ fid: entry.processingStart - entry.startTime });
        }
      });
      fidObs.observe({ type: 'first-input', buffered: true });
      observers.push(fidObs);
    }
  } catch { /* unsupported */ }

  // TTFB
  try {
    if (typeof performance !== 'undefined') {
      const navEntries = performance.getEntriesByType('navigation') as Array<PerformanceEntry & { responseStart: number }>;
      const nav = navEntries[0];
      if (nav) {
        updateVitals({ ttfb: nav.responseStart });
      }
    }
  } catch { /* unsupported */ }

  // Error listener
  const errorHandler = (ev: ErrorEvent): void => {
    errors.set([...errors.peek(), ev]);
    opts?.onError?.(ev);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('error', errorHandler);
  }

  const handle: RUMHandle = {
    vitals,
    errors,
    pageViews,
    flush(): void {
      if (!opts?.endpoint) return;
      const sampleRate = opts?.sampleRate ?? 1;
      if (Math.random() > sampleRate) return;
      const payload = {
        vitals: vitals.peek(),
        appName: opts?.appName,
        appVersion: opts?.appVersion,
        timestamp: Date.now(),
        url: typeof location !== 'undefined' ? location.href : '',
      };
      void fetch(opts.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => { /* best effort */ });
    },
    destroy(): void {
      for (const obs of observers) {
        try { obs.disconnect(); } catch { /* ignore */ }
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('error', errorHandler);
      }
      if (flushTimer) clearInterval(flushTimer);
    },
  };

  const flushMs = opts?.flushInterval ?? 10000;
  if (flushMs > 0 && opts?.endpoint) {
    flushTimer = setInterval(() => { handle.flush(); }, flushMs);
  }

  return handle;
}
