export interface FlipOptions {
  duration?: number;
  easing?:   string;
  onStart?:  () => void;
  onEnd?:    () => void;
}

export interface FlipHandle {
  first:   () => void;
  last:    () => void;
  play:    () => void;
  animate: (fn: () => void) => void;
}

export function createFlip(element: HTMLElement, opts?: FlipOptions): FlipHandle {
  const duration = opts?.duration ?? 300;
  const easing   = opts?.easing   ?? 'ease-out';

  let firstRect: DOMRect | null = null;
  let lastRect:  DOMRect | null = null;

  function first(): void {
    firstRect = element.getBoundingClientRect();
  }

  function last(): void {
    lastRect = element.getBoundingClientRect();
  }

  function play(): void {
    if (!firstRect || !lastRect) return;

    const dx  = firstRect.x      - lastRect.x;
    const dy  = firstRect.y      - lastRect.y;
    const dsx = lastRect.width   > 0 ? firstRect.width  / lastRect.width  : 1;
    const dsy = lastRect.height  > 0 ? firstRect.height / lastRect.height : 1;

    if (dx === 0 && dy === 0 && dsx === 1 && dsy === 1) {
      opts?.onEnd?.();
      return;
    }

    opts?.onStart?.();

    const keyframes: Keyframe[] = [
      { transform: `translate(${dx}px, ${dy}px) scaleX(${dsx}) scaleY(${dsy})` },
      { transform: 'translate(0px, 0px) scaleX(1) scaleY(1)' },
    ];

    const timing: KeyframeAnimationOptions = { duration, easing, fill: 'forwards' };

    if (typeof element.animate === 'function') {
      const anim = element.animate(keyframes, timing);
      anim.addEventListener('finish', () => {
        element.style.transform = '';
        opts?.onEnd?.();
      });
    } else {
      // Fallback: no Web Animations API, just clean up
      element.style.transform = '';
      opts?.onEnd?.();
    }
  }

  function animate(fn: () => void): void {
    first();
    fn();
    last();
    play();
  }

  return { first, last, play, animate };
}
