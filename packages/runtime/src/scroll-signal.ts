import { signal, computed } from './signal.js';

export interface ScrollProgressHandle {
  progress:  () => number;
  visible:   () => boolean;
  direction: () => 'up' | 'down' | 'none';
  scrollY:   () => number;
  stop:      () => void;
}

export function scrollProgressSignal(
  element: HTMLElement | (() => HTMLElement | null),
  opts?: { rootMargin?: string; threshold?: number },
): ScrollProgressHandle {
  const getEl = typeof element === 'function' ? element : () => element;

  const _progress  = signal(0);
  const _visible   = signal(false);
  const _direction = signal<'up' | 'down' | 'none'>('none');
  const _scrollY   = signal(typeof window !== 'undefined' ? window.scrollY : 0);

  let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  let observer: IntersectionObserver | null = null;

  function computeProgress(): void {
    const el = getEl();
    if (!el || typeof window === 'undefined') return;
    const rect      = el.getBoundingClientRect();
    const vh        = window.innerHeight;
    // 0 = just entered at bottom, 1 = just exited at top
    const raw = 1 - (rect.bottom / (vh + rect.height));
    _progress.set(Math.max(0, Math.min(1, raw)));
  }

  function onScroll(): void {
    if (typeof window === 'undefined') return;
    const y = window.scrollY;
    if (y > lastScrollY) {
      _direction.set('down');
    } else if (y < lastScrollY) {
      _direction.set('up');
    }
    lastScrollY = y;
    _scrollY.set(y);
    computeProgress();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true });

    const el = getEl();
    if (el && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            _visible.set(entry.isIntersecting);
          }
          computeProgress();
        },
        {
          rootMargin: opts?.rootMargin ?? '0px',
          threshold:  opts?.threshold  ?? 0,
        },
      );
      observer.observe(el);
    }

    computeProgress();
  }

  return {
    progress:  () => _progress(),
    visible:   () => _visible(),
    direction: () => _direction(),
    scrollY:   () => _scrollY(),
    stop(): void {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', onScroll);
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    },
  };
}

export function windowScrollSignal(): {
  scrollY:   () => number;
  scrollX:   () => number;
  direction: () => 'up' | 'down' | 'none';
} {
  const _scrollY   = signal(typeof window !== 'undefined' ? window.scrollY : 0);
  const _scrollX   = signal(typeof window !== 'undefined' ? window.scrollX : 0);
  const _direction = signal<'up' | 'down' | 'none'>('none');

  let lastY = typeof window !== 'undefined' ? window.scrollY : 0;

  function onScroll(): void {
    if (typeof window === 'undefined') return;
    const y = window.scrollY;
    const x = window.scrollX;
    if (y > lastY) {
      _direction.set('down');
    } else if (y < lastY) {
      _direction.set('up');
    }
    lastY = y;
    _scrollY.set(y);
    _scrollX.set(x);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  return {
    scrollY:   () => _scrollY(),
    scrollX:   () => _scrollX(),
    direction: () => _direction(),
  };
}
