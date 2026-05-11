import { describe, it, expect, vi } from 'vitest';
import { createDevtoolsBridge } from '../bridge.js';

describe('createDevtoolsBridge', () => {
  it('creates bridge without throwing', () => {
    expect(() => createDevtoolsBridge()).not.toThrow();
  });

  it('postUpdate calls window.postMessage', () => {
    const postSpy = vi.spyOn(window, 'postMessage');
    const bridge = createDevtoolsBridge();
    bridge.postUpdate({ id: '1', label: 'count', value: 42, type: 'signal', timestamp: Date.now() });
    expect(postSpy).toHaveBeenCalled();
    postSpy.mockRestore();
  });

  it('onMessage registers event listener', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const bridge = createDevtoolsBridge();
    const cleanup = bridge.onMessage(() => {});
    expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
    cleanup();
    addSpy.mockRestore();
  });

  it('onMessage cleanup removes listener', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const bridge = createDevtoolsBridge();
    const cleanup = bridge.onMessage(() => {});
    cleanup();
    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});
