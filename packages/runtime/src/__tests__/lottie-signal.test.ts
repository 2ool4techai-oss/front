// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { lottieSignal } from '../lottie-signal.js';

function makeMockAdapter() {
  const instance = {
    totalFrames: 60, currentFrame: 0,
    play: vi.fn(), pause: vi.fn(), stop: vi.fn(),
    goToAndPlay: vi.fn(), goToAndStop: vi.fn(),
    setSpeed: vi.fn(), destroy: vi.fn(),
    _listeners: {} as Record<string, () => void>,
    addEventListener(e: string, cb: () => void) { this._listeners[e] = cb; },
    removeEventListener: vi.fn(),
  };
  return {
    adapter: { loadAnimation: () => instance },
    instance,
  };
}

describe('lottieSignal', () => {
  it('initializes with defaults', () => {
    const lottie = lottieSignal();
    expect(lottie.frame()).toBe(0);
    expect(lottie.playing()).toBe(false);
    expect(lottie.speed()).toBe(1);
  });

  it('mount sets totalFrames from adapter', () => {
    const { adapter } = makeMockAdapter();
    const lottie = lottieSignal({ adapter });
    const el = document.createElement('div');
    lottie.mount(el, '{}');
    expect(lottie.totalFrames()).toBe(60);
  });

  it('play() sets playing to true', () => {
    const { adapter } = makeMockAdapter();
    const lottie = lottieSignal({ adapter });
    const el = document.createElement('div');
    lottie.mount(el, '{}');
    lottie.play();
    expect(lottie.playing()).toBe(true);
  });

  it('pause() sets playing to false', () => {
    const { adapter } = makeMockAdapter();
    const lottie = lottieSignal({ adapter });
    const el = document.createElement('div');
    lottie.mount(el, '{}');
    lottie.play();
    lottie.pause();
    expect(lottie.playing()).toBe(false);
  });

  it('progress() is frame/totalFrames', () => {
    const { adapter } = makeMockAdapter();
    const lottie = lottieSignal({ adapter });
    const el = document.createElement('div');
    lottie.mount(el, '{}');
    lottie.seek(30);
    expect(lottie.progress()).toBeCloseTo(0.5, 1);
  });
});
