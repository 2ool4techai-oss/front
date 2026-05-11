import { signal } from './signal.js';
import { _setSignalWriteHook, _getDevSignals } from './signal.js';
import type { Signal } from './types.js';

export interface OtelSpan {
  traceId:    string;
  spanId:     string;
  name:       string;
  startTime:  number;
  endTime:    number;
  attributes: Record<string, string | number | boolean>;
  status:     'ok' | 'error';
}

export interface OtelOptions {
  serviceName?:   string;
  endpoint?:      string;
  maxBatchSize?:  number;
  flushInterval?: number;
  sampleRate?:    number;
  include?:       string[];
  exclude?:       string[];
  onSpan?:        (span: OtelSpan) => void;
}

export interface OtelHandle {
  readonly spans: readonly OtelSpan[];
  startSpan(name: string, attrs?: Record<string, string | number | boolean>): OtelSpan;
  endSpan(span: OtelSpan, status?: 'ok' | 'error'): void;
  flush(): Promise<void>;
  destroy(): void;
}

function generateId(): string {
  return Math.random().toString(16).slice(2, 18);
}

export function createOtelTracer(opts?: OtelOptions): OtelHandle {
  const maxBatchSize = opts?.maxBatchSize ?? 50;
  const sampleRate   = opts?.sampleRate   ?? 1;
  const traceId      = generateId();
  const spans: OtelSpan[] = [];

  let flushTimer: ReturnType<typeof setInterval> | undefined;

  function addSpan(span: OtelSpan): void {
    // ring buffer
    if (spans.length >= maxBatchSize) {
      spans.shift();
    }
    spans.push(span);
    opts?.onSpan?.(span);
  }

  // Install write hook
  _setSignalWriteHook((sig: Signal<unknown>, lbl: string, prev: unknown, next: unknown) => {
    // include/exclude filter
    if (opts?.include && !opts.include.includes(lbl)) return;
    if (opts?.exclude && opts.exclude.includes(lbl)) return;
    // sample rate
    if (sampleRate < 1 && Math.random() > sampleRate) return;

    const now = Date.now();
    const span: OtelSpan = {
      traceId,
      spanId:    generateId(),
      name:      `signal.write:${lbl}`,
      startTime: now,
      endTime:   now,
      attributes: {
        'signal.label': lbl,
        'signal.prev':  String(prev),
        'signal.next':  String(next),
      },
      status: 'ok',
    };
    addSpan(span);
  });

  if (opts?.flushInterval && opts.flushInterval > 0) {
    flushTimer = setInterval(() => {
      void handle.flush();
    }, opts.flushInterval);
  }

  const handle: OtelHandle = {
    get spans(): readonly OtelSpan[] {
      return spans;
    },

    startSpan(name: string, attrs?: Record<string, string | number | boolean>): OtelSpan {
      const span: OtelSpan = {
        traceId,
        spanId:     generateId(),
        name,
        startTime:  Date.now(),
        endTime:    0,
        attributes: attrs ? { ...attrs } : {},
        status:     'ok',
      };
      return span;
    },

    endSpan(span: OtelSpan, status: 'ok' | 'error' = 'ok'): void {
      span.endTime = Date.now();
      span.status  = status;
      addSpan(span);
    },

    async flush(): Promise<void> {
      if (!opts?.endpoint || spans.length === 0) return;
      const payload = { resourceSpans: [{ spans: [...spans] }] };
      try {
        await fetch(opts.endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
      } catch {
        // best-effort
      }
    },

    destroy(): void {
      _setSignalWriteHook(null);
      if (flushTimer !== undefined) {
        clearInterval(flushTimer);
        flushTimer = undefined;
      }
    },
  };

  return handle;
}
