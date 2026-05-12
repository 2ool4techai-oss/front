import { signal } from './signal.js';

export interface SSESignalOptions {
  reconnectMs?: number;
  maxRetries?: number;
  parseJson?: boolean;
  onError?: (err: Event) => void;
}

export interface SSEHandle<T> {
  data: () => T | undefined;
  status: () => 'connecting' | 'open' | 'closed' | 'error';
  close: () => void;
  retryCount: () => number;
}

export function sseSignal<T = unknown>(url: string, opts?: SSESignalOptions): SSEHandle<T> {
  const reconnectMs = opts?.reconnectMs ?? 3000;
  const maxRetries = opts?.maxRetries ?? 0;
  const parseJson = opts?.parseJson ?? true;

  const dataSig = signal<T | undefined>(undefined);
  const statusSig = signal<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const retrySig = signal(0);

  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function clearTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function connect(): void {
    if (typeof (globalThis as Record<string, unknown>).EventSource === 'undefined') {
      statusSig.set('error');
      return;
    }

    statusSig.set('connecting');
    es = new EventSource(url);

    es.onmessage = (e: MessageEvent) => {
      statusSig.set('open');
      if (parseJson) {
        try {
          dataSig.set(JSON.parse(e.data as string) as T);
        } catch {
          dataSig.set(e.data as unknown as T);
        }
      } else {
        dataSig.set(e.data as unknown as T);
      }
    };

    es.onerror = (e: Event) => {
      opts?.onError?.(e);
      statusSig.set('error');

      const currentRetries = retrySig.peek();
      const nextRetries = currentRetries + 1;
      retrySig.set(nextRetries);

      if (!closed && (maxRetries === 0 || nextRetries <= maxRetries)) {
        clearTimer();
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!closed) {
            es?.close();
            connect();
          }
        }, reconnectMs);
      }
    };
  }

  connect();

  return {
    data: dataSig,
    status: statusSig,
    retryCount: retrySig,
    close(): void {
      closed = true;
      clearTimer();
      es?.close();
      statusSig.set('closed');
    },
  };
}
