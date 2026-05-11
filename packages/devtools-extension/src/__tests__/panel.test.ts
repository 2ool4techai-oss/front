import { describe, it, expect } from 'vitest';
import { createPanel } from '../panel.js';
import type { SignalSnapshot } from '../bridge.js';

function makeSnap(label: string, value: unknown): SignalSnapshot {
  return { id: label, label, value, type: 'signal', timestamp: Date.now() };
}

describe('createPanel', () => {
  it('creates panel without throwing', () => {
    const container = document.createElement('div');
    expect(() => createPanel({ container })).not.toThrow();
  });

  it('addSignal adds to list', () => {
    const container = document.createElement('div');
    const panel = createPanel({ container });
    panel.addSignal(makeSnap('count', 5));
    expect(panel.getSignals()).toHaveLength(1);
  });

  it('addSignal upserts by id', () => {
    const container = document.createElement('div');
    const panel = createPanel({ container });
    panel.addSignal(makeSnap('count', 5));
    panel.addSignal(makeSnap('count', 10));
    expect(panel.getSignals()).toHaveLength(1);
    expect(panel.getSignals()[0]!.value).toBe(10);
  });

  it('clear() empties signals', () => {
    const container = document.createElement('div');
    const panel = createPanel({ container });
    panel.addSignal(makeSnap('count', 5));
    panel.clear();
    expect(panel.getSignals()).toHaveLength(0);
  });

  it('filter() filters visible signals', () => {
    const container = document.createElement('div');
    const panel = createPanel({ container });
    panel.addSignal(makeSnap('userCount', 5));
    panel.addSignal(makeSnap('cartItems', 3));
    panel.filter('user');
    const rows = container.querySelectorAll('.dr-signal-row:not([hidden])');
    expect(rows.length).toBe(1);
  });

  it('destroy() does not throw', () => {
    const container = document.createElement('div');
    const panel = createPanel({ container });
    expect(() => panel.destroy()).not.toThrow();
  });
});
