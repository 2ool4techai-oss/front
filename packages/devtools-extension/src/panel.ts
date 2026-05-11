import type { SignalSnapshot } from './bridge.js';

export interface PanelOptions {
  container: HTMLElement;
}

export interface PanelHandle {
  addSignal(snap: SignalSnapshot): void;
  clear(): void;
  filter(query: string): void;
  getSignals(): SignalSnapshot[];
  destroy(): void;
}

export function createPanel(opts: PanelOptions): PanelHandle {
  const { container } = opts;
  const signals = new Map<string, SignalSnapshot>();
  let currentFilter = '';

  function render(): void {
    container.innerHTML = '';
    for (const snap of signals.values()) {
      const row = document.createElement('div');
      row.className = 'dr-signal-row';
      row.textContent = `${snap.label}: ${JSON.stringify(snap.value, null, 2)}`;
      if (currentFilter && !snap.label.includes(currentFilter)) {
        row.hidden = true;
      }
      container.appendChild(row);
    }
  }

  function addSignal(snap: SignalSnapshot): void {
    signals.set(snap.id, snap);
    render();
  }

  function clear(): void {
    signals.clear();
    render();
  }

  function filter(query: string): void {
    currentFilter = query;
    render();
  }

  function getSignals(): SignalSnapshot[] {
    return Array.from(signals.values());
  }

  function destroy(): void {
    container.innerHTML = '';
    signals.clear();
  }

  return { addSignal, clear, filter, getSignals, destroy };
}
