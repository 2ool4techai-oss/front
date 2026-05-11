import { signal } from '@drishti/runtime';
import type { Signal, SignalSubscriber, Unsubscribe } from '@drishti/runtime';

export interface CursorUser {
  id:    string;
  name:  string;
  color: string;
  x:     number;
  y:     number;
}

export interface CollabCursorOptions {
  userId:     string;
  userName?:  string;
  color?:     string;
  container?: HTMLElement;
  showNames?: boolean;
  smoothing?: number;
}

export interface CollabCursorHandle {
  readonly cursors: Signal<CursorUser[]>;
  readonly myColor: string;
  setPosition(x: number, y: number): void;
  destroy(): void;
}

// ── Helpers ────────────────────────────────────────────────────────────

const PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'] as const;

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}

function pickColor(userId: string): string {
  return PALETTE[djb2(userId) % PALETTE.length] as string;
}

let _stylesInjected = false;

function injectStyles(smoothing: number): void {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'dr-collab-cursors-style';
  style.textContent = `
.dr-cursor {
  position: fixed;
  pointer-events: none;
  z-index: 99999;
  transform: translate(-2px, -2px);
  transition: left ${smoothing}ms linear, top ${smoothing}ms linear;
}
.dr-cursor-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.8);
}
.dr-cursor-label {
  font-size: 11px;
  color: #fff;
  padding: 1px 5px;
  border-radius: 4px;
  margin-top: 2px;
  white-space: nowrap;
  font-family: sans-serif;
}
`;
  document.head.appendChild(style);
}

export function createCollabCursors(
  _session: import('@drishti/runtime').CollabHandle,
  opts: CollabCursorOptions,
): CollabCursorHandle {
  const {
    userId,
    userName   = userId,
    showNames  = true,
    smoothing  = 80,
    container,
  } = opts;

  const myColor = opts.color ?? pickColor(userId);

  // Internal map: userId -> CursorUser
  const _map = signal<Record<string, CursorUser>>({});

  // Derived cursors signal kept in sync with _map
  const cursorsSignal = signal<CursorUser[]>([]);
  const _mapUnsub = _map.subscribe((map: Record<string, CursorUser>) => {
    cursorsSignal.set(Object.values(map));
  });

  // DOM cursor elements keyed by user id
  const _domCursors = new Map<string, HTMLElement>();

  injectStyles(smoothing);

  function getCursorEl(user: CursorUser): HTMLElement {
    let el = _domCursors.get(user.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'dr-cursor';
      el.dataset['userId'] = user.id;

      const dot = document.createElement('div');
      dot.className = 'dr-cursor-dot';
      dot.style.background = user.color;
      el.appendChild(dot);

      if (showNames) {
        const label = document.createElement('div');
        label.className = 'dr-cursor-label';
        label.style.background = user.color;
        label.textContent = user.name;
        el.appendChild(label);
      }

      document.body.appendChild(el);
      _domCursors.set(user.id, el);
    }
    return el;
  }

  function renderCursors(): void {
    const all = Object.values(_map.peek());
    const seen = new Set<string>();
    for (const user of all) {
      if (user.id === userId) continue; // don't render own cursor as DOM element
      seen.add(user.id);
      const el = getCursorEl(user);
      el.style.left = `${user.x}px`;
      el.style.top  = `${user.y}px`;
    }
    // Remove stale cursors
    for (const [id, el] of _domCursors.entries()) {
      if (!seen.has(id)) {
        el.remove();
        _domCursors.delete(id);
      }
    }
  }

  // Subscribe to map changes to update DOM
  const _renderUnsub = _map.subscribe(() => renderCursors());

  function onMouseMove(e: MouseEvent): void {
    const rect = getContainerRect();
    setPosition(e.clientX - rect.left, e.clientY - rect.top);
  }

  function onTouchMove(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = getContainerRect();
    setPosition(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  function getContainerRect(): { left: number; top: number } {
    if (container != null) return container.getBoundingClientRect();
    return { left: 0, top: 0 };
  }

  const trackTarget: EventTarget = container ?? document;
  trackTarget.addEventListener('mousemove', onMouseMove as EventListener);
  trackTarget.addEventListener('touchmove', onTouchMove as EventListener, { passive: true } as AddEventListenerOptions);

  function setPosition(x: number, y: number): void {
    const prev = _map.peek();
    _map.set({
      ...prev,
      [userId]: { id: userId, name: userName, color: myColor, x, y },
    });
  }

  return {
    cursors: cursorsSignal,
    myColor,
    setPosition,
    destroy(): void {
      _mapUnsub();
      _renderUnsub();
      trackTarget.removeEventListener('mousemove', onMouseMove as EventListener);
      trackTarget.removeEventListener('touchmove', onTouchMove as EventListener);
      for (const el of _domCursors.values()) {
        el.remove();
      }
      _domCursors.clear();
    },
  };
}
