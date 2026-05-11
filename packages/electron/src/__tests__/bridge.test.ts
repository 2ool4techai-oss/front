import { describe, it, expect, vi } from 'vitest';
import { createMainBridge, createRendererBridge } from '../bridge.js';
import type { IpcMain, IpcRenderer } from '../bridge.js';

function makeIpcMain(): IpcMain & { trigger: (label: string, value: unknown) => void } {
  const listeners: Array<(event: unknown, ...args: unknown[]) => void> = [];
  return {
    on(_ch: string, l: (event: unknown, ...args: unknown[]) => void) { listeners.push(l); },
    removeListener(_ch: string, l: (...args: unknown[]) => void) {
      const idx = listeners.indexOf(l as (event: unknown, ...args: unknown[]) => void);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    trigger(label: string, value: unknown) { listeners.forEach(l => l(null, label, value)); },
  };
}

function makeIpcRenderer(): IpcRenderer & { trigger: (label: string, value: unknown) => void } {
  const listeners: Array<(event: unknown, ...args: unknown[]) => void> = [];
  const sent: Array<[string, ...unknown[]]> = [];
  return {
    on(_ch: string, l: (event: unknown, ...args: unknown[]) => void) { listeners.push(l); },
    removeListener(_ch: string, l: (...args: unknown[]) => void) {
      const idx = listeners.indexOf(l as (event: unknown, ...args: unknown[]) => void);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    send(_ch: string, ...args: unknown[]) { sent.push([_ch, ...args]); },
    trigger(label: string, value: unknown) { listeners.forEach(l => l(null, label, value)); },
  };
}

describe('createMainBridge', () => {
  it('creates bridge', () => {
    expect(() => createMainBridge(makeIpcMain())).not.toThrow();
  });

  it('onUpdate fires when ipc message received', () => {
    const ipc = makeIpcMain();
    const bridge = createMainBridge(ipc);
    const received: Array<[string, unknown]> = [];
    bridge.onUpdate((l, v) => received.push([l, v]));
    ipc.trigger('count', 42);
    expect(received).toEqual([['count', 42]]);
    bridge.destroy();
  });

  it('allowedKeys filters messages', () => {
    const ipc = makeIpcMain();
    const bridge = createMainBridge(ipc, { allowedKeys: ['count'] });
    const received: string[] = [];
    bridge.onUpdate((l) => received.push(l));
    ipc.trigger('count', 1);
    ipc.trigger('secret', 99);
    expect(received).toEqual(['count']);
    bridge.destroy();
  });

  it('destroy removes listener', () => {
    const ipc = makeIpcMain();
    const bridge = createMainBridge(ipc);
    const received: unknown[] = [];
    bridge.onUpdate((_, v) => received.push(v));
    bridge.destroy();
    ipc.trigger('count', 99);
    expect(received).toHaveLength(0);
  });

  it('onUpdate cleanup unregisters handler', () => {
    const ipc = makeIpcMain();
    const bridge = createMainBridge(ipc);
    const received: unknown[] = [];
    const unsub = bridge.onUpdate((_, v) => received.push(v));
    unsub();
    ipc.trigger('count', 99);
    expect(received).toHaveLength(0);
    bridge.destroy();
  });
});

describe('createRendererBridge', () => {
  it('creates bridge', () => {
    expect(() => createRendererBridge(makeIpcRenderer())).not.toThrow();
  });

  it('send() calls ipcRenderer.send', () => {
    const ipc = makeIpcRenderer();
    const sendSpy = vi.spyOn(ipc, 'send');
    const bridge = createRendererBridge(ipc);
    bridge.send('count', 5);
    expect(sendSpy).toHaveBeenCalled();
    bridge.destroy();
  });

  it('onUpdate fires when message received', () => {
    const ipc = makeIpcRenderer();
    const bridge = createRendererBridge(ipc);
    const received: unknown[] = [];
    bridge.onUpdate((_, v) => received.push(v));
    ipc.trigger('count', 7);
    expect(received).toEqual([7]);
    bridge.destroy();
  });
});
