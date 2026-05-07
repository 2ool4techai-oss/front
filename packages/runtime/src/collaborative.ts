import { signal } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type CollabClientId = string;

export interface VectorClock {
  [clientId: string]: number;
}

export interface CollabOperation {
  type:      'set' | 'presence';
  key:       string;
  value:     unknown;
  clientId:  CollabClientId;
  clock:     VectorClock;
  timestamp: number;
}

export interface PresenceState {
  clientId:  CollabClientId;
  data:      Record<string, unknown>;
  lastSeen:  number;
}

export interface CollabOptions {
  url?:            string;
  clientId?:       CollabClientId;
  reconnect?:      boolean;
  reconnectDelay?: number;
  presence?:       boolean;
  presenceData?:   () => Record<string, unknown>;
  onConnect?:      () => void;
  onDisconnect?:   () => void;
  onError?:        (err: Event) => void;
  WebSocketImpl?:  typeof WebSocket;
}

export interface CollabHandle {
  readonly clientId:  CollabClientId;
  readonly connected: Signal<boolean>;
  readonly peers:     Signal<PresenceState[]>;
  signal<T>(key: string, initial: T): CollaborativeSignal<T>;
  updatePresence(data: Record<string, unknown>): void;
  destroy(): void;
}

export interface CollaborativeSignal<T> extends Signal<T> {
  readonly key:      string;
  readonly clientId: CollabClientId;
  readonly lastOp:   Signal<CollabOperation | null>;
}

// ── Implementation ─────────────────────────────────────────────────────

type IncomingMessage =
  | CollabOperation
  | { type: 'hello';    clientId: string; clock: VectorClock }
  | { type: 'presence'; clientId: string; data: Record<string, unknown>; timestamp: number }
  | { type: 'peers';    peers: PresenceState[] };

export function createCollabSession(opts: CollabOptions = {}): CollabHandle {
  const clientId = opts.clientId ?? `client_${Math.random().toString(36).slice(2, 10)}`;
  const clock: VectorClock = { [clientId]: 0 };

  const _keyState = new Map<string, { value: unknown; clock: VectorClock; timestamp: number }>();
  const _signals  = new Map<string, Signal<unknown>>();
  const _lastOps  = new Map<string, Signal<CollabOperation | null>>();

  const connected = signal(false);
  const peers     = signal<PresenceState[]>([]);

  let ws: WebSocket | null = null;
  let _destroyed = false;

  // ── Vector clock helpers ──────────────────────────────────────────────
  function clockWins(
    opClock: VectorClock,
    localClock: VectorClock,
    opClientId: string,
    localTimestamp: number,
    opTimestamp: number,
  ): boolean {
    const opSum    = Object.values(opClock).reduce((a, b) => a + b, 0);
    const localSum = Object.values(localClock).reduce((a, b) => a + b, 0);
    if (opSum !== localSum) return opSum > localSum;
    if (opTimestamp !== localTimestamp) return opTimestamp > localTimestamp;
    return opClientId > clientId;
  }

  // ── WebSocket connection ───────────────────────────────────────────────
  const WS = opts.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : null);

  function connect(): void {
    if (!opts.url || !WS) return;
    try {
      ws = new WS(opts.url);
      ws.addEventListener('open', () => {
        connected.set(true);
        opts.onConnect?.();
        sendRaw({ type: 'hello', clientId, clock });
      });
      ws.addEventListener('message', (e: MessageEvent) => {
        try { handleMessage(JSON.parse(e.data as string) as IncomingMessage); } catch { /* ignore malformed */ }
      });
      ws.addEventListener('close', () => {
        connected.set(false);
        opts.onDisconnect?.();
        if (!_destroyed && opts.reconnect !== false) {
          setTimeout(connect, opts.reconnectDelay ?? 1000);
        }
      });
      ws.addEventListener('error', (e: Event) => opts.onError?.(e));
    } catch { /* ignore connection errors */ }
  }

  function sendRaw(msg: unknown): void {
    if (ws?.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(msg));
    }
  }

  function handleMessage(msg: IncomingMessage): void {
    if (msg.type === 'set') {
      applyOp(msg as CollabOperation);
    } else if (msg.type === 'presence') {
      const m = msg as { type: 'presence'; clientId: string; data: Record<string, unknown>; timestamp: number };
      const current = peers.peek();
      const idx     = current.findIndex(p => p.clientId === m.clientId);
      const updated = [...current];
      const entry: PresenceState = { clientId: m.clientId, data: m.data, lastSeen: m.timestamp };
      if (idx >= 0) updated[idx] = entry; else updated.push(entry);
      peers.set(updated);
    } else if (msg.type === 'peers') {
      peers.set((msg as { type: 'peers'; peers: PresenceState[] }).peers);
    }
  }

  function applyOp(op: CollabOperation): void {
    if (op.clientId === clientId) return; // echo suppression
    const existing = _keyState.get(op.key);

    if (existing && !clockWins(op.clock, existing.clock, op.clientId, existing.timestamp, op.timestamp)) {
      return; // local state wins — discard
    }

    _keyState.set(op.key, { value: op.value, clock: op.clock, timestamp: op.timestamp });

    for (const [id, v] of Object.entries(op.clock)) {
      clock[id] = Math.max(clock[id] ?? 0, v);
    }

    const sig = _signals.get(op.key);
    if (sig) sig.set(op.value as never);

    const lastOp = _lastOps.get(op.key);
    if (lastOp) lastOp.set(op);
  }

  // ── Public API ────────────────────────────────────────────────────────
  function createCollabSignal<T>(key: string, initial: T): CollaborativeSignal<T> {
    if (_signals.has(key)) return _signals.get(key) as CollaborativeSignal<T>;

    const inner  = signal<T>((_keyState.get(key)?.value as T) ?? initial);
    const lastOp = signal<CollabOperation | null>(null);
    _signals.set(key, inner as Signal<unknown>);
    _lastOps.set(key, lastOp as Signal<CollabOperation | null>);

    const originalSet = inner.set.bind(inner);
    const wrappedSet  = (next: T): void => {
      if (Object.is(inner.peek(), next)) return;
      originalSet(next);
      clock[clientId] = (clock[clientId] ?? 0) + 1;
      const op: CollabOperation = {
        type:      'set',
        key,
        value:     next,
        clientId,
        clock:     { ...clock },
        timestamp: Date.now(),
      };
      _keyState.set(key, { value: next, clock: { ...clock }, timestamp: op.timestamp });
      sendRaw(op);
    };

    const sig = Object.assign(inner, {
      set:      wrappedSet,
      key,
      clientId,
      lastOp,
    }) as CollaborativeSignal<T>;

    return sig;
  }

  connect();

  return {
    clientId,
    connected,
    peers,
    signal: createCollabSignal,
    updatePresence(data: Record<string, unknown>): void {
      const msg = { type: 'presence' as const, clientId, data, timestamp: Date.now() };
      sendRaw(msg);
      const current = peers.peek();
      const idx     = current.findIndex(p => p.clientId === clientId);
      const updated = [...current];
      const entry: PresenceState = { clientId, data, lastSeen: msg.timestamp };
      if (idx >= 0) updated[idx] = entry; else updated.push(entry);
      peers.set(updated);
    },
    destroy(): void {
      _destroyed = true;
      ws?.close();
      ws = null;
      connected.set(false);
    },
  };
}
