import { describe, it, expect, vi } from 'vitest';
import { createNetworkSignal } from '../network.js';
import type { CapacitorNetwork } from '../network.js';

function makeNetwork(connected = true): CapacitorNetwork & {
  fireChange(s: { connected: boolean; connectionType: string }): void;
} {
  const listeners: Array<(s: { connected: boolean; connectionType: string }) => void> = [];
  return {
    getStatus: async () => ({ connected, connectionType: 'wifi' }),
    addListener: async (_event, handler) => {
      listeners.push(handler);
      return { remove: () => { const i = listeners.indexOf(handler); if (i >= 0) listeners.splice(i, 1); } };
    },
    fireChange(s) { listeners.forEach(l => l(s)); },
  };
}

describe('createNetworkSignal', () => {
  it('creates handle', () => {
    expect(() => createNetworkSignal(makeNetwork())).not.toThrow();
  });

  it('initial state has connected=true', () => {
    const h = createNetworkSignal(makeNetwork(true));
    expect(h.state.connected).toBe(true);
  });

  it('state updates on networkStatusChange', () => {
    const net = makeNetwork(true);
    const h = createNetworkSignal(net);
    net.fireChange({ connected: false, connectionType: 'none' });
    expect(h.state.connected).toBe(false);
  });

  it('destroy() does not throw', () => {
    const h = createNetworkSignal(makeNetwork());
    expect(() => h.destroy()).not.toThrow();
  });
});
