import { signal, batch } from './signal.js';
import { _setSignalWriteHook } from './signal.js';
import type { Signal } from './types.js';

export interface TimeTravelEntry {
  id:        number;
  timestamp: number;
  label:     string;
  prev:      unknown;
  next:      unknown;
  /** WeakRef so GC'd signals don't prevent cleanup */
  _ref:      WeakRef<Signal<unknown>>;
}

export interface TimeTravelOptions {
  maxHistory?: number; // default 200
}

export interface TimeTravelHandle {
  /** Read-only snapshot of the history array */
  readonly history:   readonly TimeTravelEntry[];
  /** Current cursor position (0 = oldest, history.length-1 = latest) */
  readonly cursor:    number;
  readonly canUndo:   boolean;
  readonly canRedo:   boolean;
  /** Step back one change */
  undo(): void;
  /** Step forward one change */
  redo(): void;
  /** Jump to any index in history */
  goto(index: number): void;
  /** Clear all history */
  clear(): void;
  /** Pause recording (changes still happen, just not recorded) */
  pause(): void;
  /** Resume recording */
  resume(): void;
  readonly recording: boolean;
  /** Uninstall the time-travel hook entirely */
  destroy(): void;
}

// Reactive state signal for the devtools panel to subscribe to
export const _ttState = signal<{ cursor: number; length: number; recording: boolean }>({
  cursor: -1,
  length: 0,
  recording: true,
});

let _idCounter = 0;

export function enableTimeTravel(opts?: TimeTravelOptions): TimeTravelHandle {
  const maxHistory = opts?.maxHistory ?? 200;
  const _history: TimeTravelEntry[] = [];
  let _cursor = -1;
  let _paused = false;
  let _replaying = false;

  function syncState(): void {
    // Temporarily set _replaying so the hook ignores this internal state update
    const wasReplaying = _replaying;
    _replaying = true;
    try {
      _ttState.set({ cursor: _cursor, length: _history.length, recording: !_paused });
    } finally {
      _replaying = wasReplaying;
    }
  }

  _setSignalWriteHook((sig, label, prev, next) => {
    if (_paused || _replaying) return;

    // Truncate redo stack if we're not at the latest entry
    if (_cursor < _history.length - 1) {
      _history.splice(_cursor + 1);
    }

    const entry: TimeTravelEntry = {
      id:        _idCounter++,
      timestamp: Date.now(),
      label,
      prev,
      next,
      _ref:      new WeakRef(sig),
    };

    _history.push(entry);

    // Trim oldest entries if over limit
    if (_history.length > maxHistory) {
      _history.splice(0, _history.length - maxHistory);
    }

    _cursor = _history.length - 1;
    syncState();
  });

  const handle: TimeTravelHandle = {
    get history(): readonly TimeTravelEntry[] { return _history; },
    get cursor(): number { return _cursor; },
    get canUndo(): boolean { return _cursor >= 0; },
    get canRedo(): boolean { return _cursor < _history.length - 1; },

    undo(): void {
      if (_cursor < 0) return;
      const entry = _history[_cursor];
      if (!entry) return;
      _cursor--;
      _replaying = true;
      _paused = true;
      try {
        entry._ref.deref()?.set(entry.prev as never);
      } finally {
        _paused = false;
        _replaying = false;
      }
      syncState();
    },

    redo(): void {
      if (_cursor >= _history.length - 1) return;
      _cursor++;
      const entry = _history[_cursor];
      if (!entry) return;
      _replaying = true;
      _paused = true;
      try {
        entry._ref.deref()?.set(entry.next as never);
      } finally {
        _paused = false;
        _replaying = false;
      }
      syncState();
    },

    goto(index: number): void {
      if (index < 0 || index >= _history.length) return;
      if (index === _cursor) return;

      _replaying = true;
      _paused = true;
      try {
        batch(() => {
          if (index < _cursor) {
            // Going backward: apply prev values from cursor down to index+1
            for (let i = _cursor; i > index; i--) {
              const entry = _history[i];
              if (entry) entry._ref.deref()?.set(entry.prev as never);
            }
          } else {
            // Going forward: apply next values from cursor+1 up to index
            for (let i = _cursor + 1; i <= index; i++) {
              const entry = _history[i];
              if (entry) entry._ref.deref()?.set(entry.next as never);
            }
          }
        });
      } finally {
        _paused = false;
        _replaying = false;
      }
      _cursor = index;
      syncState();
    },

    clear(): void {
      _history.splice(0);
      _cursor = -1;
      syncState();
    },

    pause(): void {
      _paused = true;
      syncState();
    },

    resume(): void {
      _paused = false;
      syncState();
    },

    get recording(): boolean { return !_paused; },

    destroy(): void {
      _setSignalWriteHook(null);
    },
  };

  syncState();
  return handle;
}
