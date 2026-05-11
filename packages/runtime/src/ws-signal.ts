import { signal } from './signal.js';
import type { Signal } from './types.js';

export type WSSignalStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface WSSignalOptions<T> {
  reconnect?:      boolean;
  reconnectDelay?: number;
  maxReconnects?:  number;
  parse?:          (raw: string) => T;
  serialize?:      (val: T) => string;
  onOpen?:         () => void;
  onClose?:        () => void;
  onError?:        (e: Event) => void;
  offlineQueue?:   boolean;
}

export interface WSSignalHandle<T> {
  readonly value:  Signal<T | undefined>;
  readonly status: Signal<WSSignalStatus>;
  send(val: T): void;
  connect(): void;
  disconnect(): void;
  destroy(): void;
}

export function createWSSignal<T>(
  url: string,
  opts?: WSSignalOptions<T>,
): WSSignalHandle<T> {
  const reconnect      = opts?.reconnect      ?? true;
  const reconnectDelay = opts?.reconnectDelay ?? 2000;
  const maxReconnects  = opts?.maxReconnects  ?? Infinity;
  const offlineQueue   = opts?.offlineQueue   ?? true;
  const parse          = opts?.parse          ?? ((raw: string) => JSON.parse(raw) as T);
  const serialize      = opts?.serialize      ?? ((val: T) => JSON.stringify(val));

  const value  = signal<T | undefined>(undefined);
  const status = signal<WSSignalStatus>('connecting');

  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let shouldReconnect = reconnect;
  const queue: string[] = [];

  function drainQueue(): void {
    while (queue.length > 0 && ws && ws.readyState === 1) {
      const msg = queue.shift();
      if (msg !== undefined) ws.send(msg);
    }
  }

  function createWS(): void {
    if (typeof WebSocket === 'undefined') return;

    ws = new WebSocket(url);
    status.set('connecting');

    ws.onopen = () => {
      status.set('open');
      reconnectAttempts = 0;
      drainQueue();
      opts?.onOpen?.();
    };

    ws.onmessage = (e: MessageEvent) => {
      try {
        const parsed = parse(e.data as string);
        value.set(parsed);
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = (e: Event) => {
      status.set('error');
      opts?.onError?.(e);
    };

    ws.onclose = () => {
      status.set('closed');
      opts?.onClose?.();
      if (shouldReconnect && reconnectAttempts < maxReconnects) {
        const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          createWS();
        }, delay);
      }
    };
  }

  createWS();

  return {
    value,
    status,

    send(val: T): void {
      const serialized = serialize(val);
      if (ws && ws.readyState === 1) {
        ws.send(serialized);
      } else if (offlineQueue) {
        queue.push(serialized);
      }
    },

    connect(): void {
      const s = status.peek();
      if (s !== 'connecting' && s !== 'open') {
        shouldReconnect = reconnect;
        createWS();
      }
    },

    disconnect(): void {
      shouldReconnect = false;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        ws.close();
        ws = null;
      }
    },

    destroy(): void {
      shouldReconnect = false;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        ws.close();
        ws = null;
      }
      queue.length = 0;
    },
  };
}
