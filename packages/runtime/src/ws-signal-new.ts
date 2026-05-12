import { signal } from './signal.js';

export interface WSSignalOptions {
  reconnectMs?: number;
  maxRetries?: number;
  parseJson?: boolean;
  protocols?: string | string[];
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
}

export interface WSHandle<TIn, TOut = TIn> {
  data: () => TIn | undefined;
  status: () => 'connecting' | 'open' | 'closed' | 'error';
  send: (msg: TOut) => void;
  close: () => void;
  retryCount: () => number;
}

export function wsSignal<TIn = unknown, TOut = TIn>(url: string, opts?: WSSignalOptions): WSHandle<TIn, TOut> {
  const reconnectMs = opts?.reconnectMs ?? 3000;
  const maxRetries = opts?.maxRetries ?? 0;
  const parseJson = opts?.parseJson ?? true;

  const dataSig = signal<TIn | undefined>(undefined);
  const statusSig = signal<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const retrySig = signal(0);

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionallyClosed = false;
  const messageQueue: string[] = [];

  function clearTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function drainQueue(): void {
    while (messageQueue.length > 0 && ws && ws.readyState === 1) {
      const msg = messageQueue.shift();
      if (msg !== undefined) ws.send(msg);
    }
  }

  function connect(): void {
    if (typeof (globalThis as Record<string, unknown>).WebSocket === 'undefined') {
      statusSig.set('error');
      return;
    }

    statusSig.set('connecting');
    ws = opts?.protocols ? new WebSocket(url, opts.protocols) : new WebSocket(url);

    ws.onopen = () => {
      statusSig.set('open');
      retrySig.set(0);
      drainQueue();
      opts?.onOpen?.();
    };

    ws.onmessage = (e: MessageEvent) => {
      if (parseJson) {
        try {
          dataSig.set(JSON.parse(e.data as string) as TIn);
        } catch {
          dataSig.set(e.data as unknown as TIn);
        }
      } else {
        dataSig.set(e.data as unknown as TIn);
      }
    };

    ws.onerror = (e: Event) => {
      opts?.onError?.(e);
      statusSig.set('error');
    };

    ws.onclose = () => {
      opts?.onClose?.();
      if (!intentionallyClosed) {
        const currentRetries = retrySig.peek();
        const nextRetries = currentRetries + 1;
        retrySig.set(nextRetries);
        statusSig.set('error');

        if (maxRetries === 0 || nextRetries <= maxRetries) {
          clearTimer();
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (!intentionallyClosed) connect();
          }, reconnectMs);
        } else {
          statusSig.set('closed');
        }
      } else {
        statusSig.set('closed');
      }
    };
  }

  connect();

  return {
    data: dataSig,
    status: statusSig,
    retryCount: retrySig,
    send(msg: TOut): void {
      let serialized: string;
      if (parseJson && typeof msg === 'object' && msg !== null) {
        serialized = JSON.stringify(msg);
      } else {
        serialized = msg as unknown as string;
      }

      if (ws && ws.readyState === 1) {
        ws.send(serialized);
      } else {
        messageQueue.push(serialized);
      }
    },
    close(): void {
      intentionallyClosed = true;
      clearTimer();
      ws?.close();
      statusSig.set('closed');
    },
  };
}
