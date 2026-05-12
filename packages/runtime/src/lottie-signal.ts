import { signal, computed } from './signal.js';

export interface LottieAdapter {
  loadAnimation(config: {
    container: HTMLElement;
    animationData?: unknown;
    path?: string;
    renderer?: 'svg' | 'canvas' | 'html';
    loop?: boolean;
    autoplay?: boolean;
  }): LottieAnimationInstance;
}

export interface LottieAnimationInstance {
  totalFrames: number;
  currentFrame: number;
  play(): void;
  pause(): void;
  stop(): void;
  goToAndPlay(frame: number, isFrame?: boolean): void;
  goToAndStop(frame: number, isFrame?: boolean): void;
  setSpeed(speed: number): void;
  destroy(): void;
  addEventListener(event: string, cb: () => void): void;
  removeEventListener(event: string, cb: () => void): void;
}

export interface LottieSignalOptions {
  adapter?: LottieAdapter;
  loop?: boolean;
  autoplay?: boolean;
  renderer?: 'svg' | 'canvas' | 'html';
}

export interface LottieHandle {
  frame: () => number;
  progress: () => number;
  speed: () => number;
  playing: () => boolean;
  totalFrames: () => number;

  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (frame: number) => void;
  setSpeed: (speed: number) => void;
  destroy: () => void;

  mount: (container: HTMLElement, src: string | object) => void;
}

function createStubInstance(): LottieAnimationInstance {
  return {
    totalFrames: 0,
    currentFrame: 0,
    play() {},
    pause() {},
    stop() {},
    goToAndPlay(_frame: number, _isFrame?: boolean) {},
    goToAndStop(_frame: number, _isFrame?: boolean) {},
    setSpeed(_speed: number) {},
    destroy() {},
    addEventListener(_event: string, _cb: () => void) {},
    removeEventListener(_event: string, _cb: () => void) {},
  };
}

export function lottieSignal(opts?: LottieSignalOptions): LottieHandle {
  const loop = opts?.loop ?? true;
  const autoplay = opts?.autoplay ?? false;
  const renderer = opts?.renderer ?? 'svg';

  const _frame = signal<number>(0);
  const _speed = signal<number>(1);
  const _playing = signal<boolean>(false);
  const _totalFrames = signal<number>(0);

  const _progress = computed(() => {
    const total = _totalFrames();
    if (total === 0) return 0;
    return _frame() / total;
  });

  let instance: LottieAnimationInstance | null = null;

  function mount(container: HTMLElement, src: string | object): void {
    const adapter = opts?.adapter;

    if (adapter) {
      const config: Parameters<LottieAdapter['loadAnimation']>[0] = {
        container,
        renderer,
        loop,
        autoplay,
      };

      if (typeof src === 'string') {
        config.path = src;
      } else {
        config.animationData = src;
      }

      instance = adapter.loadAnimation(config);
      _totalFrames.set(instance.totalFrames);
      _frame.set(instance.currentFrame);

      if (autoplay) {
        _playing.set(true);
      }

      instance.addEventListener('enterFrame', () => {
        if (instance) {
          _frame.set(instance.currentFrame);
        }
      });

      instance.addEventListener('complete', () => {
        _playing.set(false);
      });

      instance.addEventListener('loopComplete', () => {
        if (instance) {
          _frame.set(instance.currentFrame);
        }
      });
    } else {
      instance = createStubInstance();
      _totalFrames.set(0);
      _frame.set(0);
    }
  }

  function play(): void {
    if (instance) instance.play();
    _playing.set(true);
  }

  function pause(): void {
    if (instance) instance.pause();
    _playing.set(false);
  }

  function stop(): void {
    if (instance) instance.stop();
    _playing.set(false);
    _frame.set(0);
  }

  function seek(frame: number): void {
    if (instance) instance.goToAndStop(frame, true);
    _frame.set(frame);
  }

  function setSpeed(speed: number): void {
    if (instance) instance.setSpeed(speed);
    _speed.set(speed);
  }

  function destroy(): void {
    if (instance) {
      instance.destroy();
      instance = null;
    }
  }

  return {
    frame: _frame,
    progress: _progress,
    speed: _speed,
    playing: _playing,
    totalFrames: _totalFrames,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    destroy,
    mount,
  };
}
