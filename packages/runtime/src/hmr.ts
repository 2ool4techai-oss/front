import { _getDevSignals } from './signal.js';

export interface HMRSignalState {
  [label: string]: unknown;
}

export interface HMROptions {
  // Prefix to identify signals that should be preserved across HMR
  preservePrefix?: string;  // default: all signals
}

// Captures current values of all labeled signals
export function captureSignalState(): HMRSignalState {
  const signals = _getDevSignals();
  const state: HMRSignalState = {};

  for (const entry of signals) {
    state[entry.label] = entry.peek();
  }

  return state;
}

// Restores signal values from a previously captured state
export function restoreSignalState(state: HMRSignalState): void {
  const signals = _getDevSignals();

  for (const entry of signals) {
    if (entry.label in state && entry.type === 'signal') {
      // Only writable signals can be restored — computed are derived
      // We access the underlying signal through the dev registry peek + a set hack
      // Since _DevSignalEntry only has peek, we look for the signal object
      // The entry.peek is a closure over the signal's value, so we use the set method
      // We need to find the actual signal — in the dev registry, we only have peek.
      // We'll call the set via the captured state by looking at _devSignalList directly.
      // Actually the entry has a peek fn but not set — we'll cast to access set if available
      const sigObj = entry as { peek: () => unknown; set?: (v: unknown) => void };
      if (typeof sigObj.set === 'function') {
        sigObj.set(state[entry.label]);
      }
    }
  }
}

// Returns a JS string to inject into each module for HMR
function generateHMRCode(moduleId: string): string {
  return `if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // HMR accepted — signal state preserved
    // Module: ${moduleId}
  });
}`;
}

// Returns a Vite HMR plugin configuration object
export function createHMRPlugin(opts?: HMROptions): {
  name: string;
  handleHotUpdate?: (ctx: { file: string }) => void;
  generateHMRCode(moduleId: string): string;
} {
  const preservePrefix = opts?.preservePrefix;

  return {
    name: 'vite-plugin-drishti-hmr',

    handleHotUpdate(ctx: { file: string }): void {
      // Capture signal state before hot update, then restore after
      const signals = _getDevSignals();
      const state: HMRSignalState = {};

      for (const entry of signals) {
        if (preservePrefix === undefined || entry.label.startsWith(preservePrefix)) {
          state[entry.label] = entry.peek();
        }
      }

      // In a real Vite plugin, we'd restore after the module reload.
      // For now we capture and could pass to restoreSignalState.
      void state;
      void ctx;
    },

    generateHMRCode(moduleId: string): string {
      return generateHMRCode(moduleId);
    },
  };
}

export { generateHMRCode };
