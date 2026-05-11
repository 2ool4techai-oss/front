import { signal, computed, batch } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface MachineTransition<TState extends string, TContext extends Record<string, unknown>> {
  target: TState;
  action?: (ctx: TContext, event: string) => Partial<TContext>;
}

export interface MachineStateConfig<TState extends string, TEvent extends string, TContext extends Record<string, unknown>> {
  on?:    { [E in TEvent]?: TState | MachineTransition<TState, TContext> };
  entry?: (ctx: TContext) => void;
  exit?:  (ctx: TContext) => void;
  type?:  'final';
}

export interface MachineConfig<TState extends string, TEvent extends string, TContext extends Record<string, unknown> = Record<string, unknown>> {
  id?:      string;
  initial:  TState;
  context?: TContext;
  states:   { [S in TState]: MachineStateConfig<TState, TEvent, TContext> };
}

export interface MachineHistoryEntry<TState extends string, TEvent extends string> {
  from:      TState;
  event:     TEvent;
  to:        TState;
  timestamp: number;
}

export interface MachineHandle<TState extends string, TEvent extends string, TContext extends Record<string, unknown> = Record<string, unknown>> {
  readonly state:   Signal<TState>;
  readonly context: Signal<TContext>;
  readonly done:    ComputedSignal<boolean>;
  send(event: TEvent): void;
  can(event: TEvent): boolean;
  reset(): void;
  readonly history: readonly MachineHistoryEntry<TState, TEvent>[];
}

const MAX_HISTORY = 100;

// ── createMachine ──────────────────────────────────────────────────────

export function createMachine<
  TState extends string,
  TEvent extends string,
  TContext extends Record<string, unknown> = Record<string, unknown>,
>(config: MachineConfig<TState, TEvent, TContext>): MachineHandle<TState, TEvent, TContext> {
  const _state   = signal<TState>(config.initial);
  const _context = signal<TContext>(config.context ?? ({} as TContext));
  const _history: MachineHistoryEntry<TState, TEvent>[] = [];

  const _done = computed(() => {
    const s = _state();
    return config.states[s]?.type === 'final';
  });

  const handle: MachineHandle<TState, TEvent, TContext> = {
    state:   _state,
    context: _context,
    done:    _done,
    history: _history,

    can(event: TEvent): boolean {
      const cur = _state.peek();
      const stateConf = config.states[cur];
      if (!stateConf?.on) return false;
      return event in stateConf.on;
    },

    send(event: TEvent): void {
      const cur       = _state.peek();
      const stateConf = config.states[cur];
      if (!stateConf?.on) return;

      const transition = stateConf.on[event];
      if (transition === undefined) return;

      const target = (typeof transition === 'string' ? transition : transition.target) as TState;
      const action = typeof transition === 'string' ? undefined  : transition.action;

      const ctx = _context.peek();

      // Run exit on current state
      stateConf.exit?.(ctx);

      // Apply context action
      let newCtx = ctx;
      if (action) {
        const patch = action(ctx, event);
        newCtx = { ...ctx, ...patch };
      }

      // Transition
      batch(() => {
        _state.set(target);
        if (newCtx !== ctx) _context.set(newCtx);
      });

      // Run entry on new state
      config.states[target]?.entry?.(newCtx);

      // Record history
      _history.push({ from: cur, event, to: target, timestamp: Date.now() });
      if (_history.length > MAX_HISTORY) _history.shift();
    },

    reset(): void {
      batch(() => {
        _state.set(config.initial);
        _context.set(config.context ?? ({} as TContext));
      });
      _history.splice(0);
    },
  };

  // Run entry for initial state
  config.states[config.initial]?.entry?.(_context.peek());

  return handle;
}
