import { signal, computed } from './signal.js';

export interface GestureOptions {
  threshold?: number;
  preventScroll?: boolean;
}

export interface GestureState {
  dragging: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  velocityX: number;
  velocityY: number;
  startX: number;
  startY: number;
}

export interface GestureHandle {
  state: () => GestureState;
  isDragging: () => boolean;
  bind: (element: HTMLElement) => () => void;
}

export function gestureSignal(opts?: GestureOptions): GestureHandle {
  const threshold    = opts?.threshold    ?? 5;
  const preventScroll = opts?.preventScroll ?? false;

  const _state = signal<GestureState>({
    dragging: false,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    velocityX: 0,
    velocityY: 0,
    startX: 0,
    startY: 0,
  });

  const _isDragging = computed(() => _state().dragging);

  interface PosTick { x: number; y: number; t: number }
  const history: PosTick[] = [];
  const HISTORY_MS = 100;
  const HISTORY_MAX = 10;

  let isDown = false;
  let startX = 0;
  let startY = 0;

  function getRect(el: HTMLElement): { left: number; top: number } {
    try {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top };
    } catch {
      return { left: 0, top: 0 };
    }
  }

  function computeVelocity(): { vx: number; vy: number } {
    const now = Date.now();
    const cutoff = now - HISTORY_MS;
    const recent = history.filter((p) => p.t >= cutoff);
    if (recent.length < 2) return { vx: 0, vy: 0 };
    const first = recent[0]!;
    const last  = recent[recent.length - 1]!;
    const dt    = last.t - first.t;
    if (dt === 0) return { vx: 0, vy: 0 };
    return {
      vx: (last.x - first.x) / dt,
      vy: (last.y - first.y) / dt,
    };
  }

  function bind(element: HTMLElement): () => void {
    function onPointerDown(e: PointerEvent): void {
      isDown = true;
      history.length = 0;
      const rect = getRect(element);
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      history.push({ x: startX, y: startY, t: Date.now() });
      try { element.setPointerCapture(e.pointerId); } catch {}
      _state.set({
        dragging: false,
        x: startX,
        y: startY,
        dx: 0,
        dy: 0,
        velocityX: 0,
        velocityY: 0,
        startX,
        startY,
      });
    }

    function onPointerMove(e: PointerEvent): void {
      if (!isDown) return;
      if (preventScroll) e.preventDefault();
      const rect = getRect(element);
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - startX;
      const dy = y - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      history.push({ x, y, t: Date.now() });
      if (history.length > HISTORY_MAX) history.shift();

      const { vx, vy } = computeVelocity();

      _state.set({
        dragging: dist > threshold,
        x,
        y,
        dx,
        dy,
        velocityX: vx,
        velocityY: vy,
        startX,
        startY,
      });
    }

    function onPointerUp(): void {
      isDown = false;
      const prev = _state.peek();
      _state.set({
        ...prev,
        dragging: false,
        velocityX: 0,
        velocityY: 0,
      });
      history.length = 0;
    }

    element.addEventListener('pointerdown',   onPointerDown);
    element.addEventListener('pointermove',   onPointerMove);
    element.addEventListener('pointerup',     onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);

    return () => {
      element.removeEventListener('pointerdown',   onPointerDown);
      element.removeEventListener('pointermove',   onPointerMove);
      element.removeEventListener('pointerup',     onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
    };
  }

  return {
    state:     () => _state(),
    isDragging: () => _isDragging(),
    bind,
  };
}
