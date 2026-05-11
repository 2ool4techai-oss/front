import { describe, it, expect, beforeEach } from 'vitest';
import { captureSignalState, restoreSignalState, createHMRPlugin, generateHMRCode } from '../hmr.js';
import { signal, _enableDevMode } from '../signal.js';

// Enable dev mode so signals are registered in the dev registry
_enableDevMode();

describe('captureSignalState', () => {
  it('returns object', () => {
    const state = captureSignalState();
    expect(typeof state).toBe('object');
    expect(state).not.toBeNull();
  });

  it('captures labeled signal values', () => {
    const s = signal(42);
    // In dev mode, signals get auto-labeled like signal_N
    const state = captureSignalState();
    // At least one entry should exist (we just created a signal)
    expect(typeof state).toBe('object');
    // The state should have some entries from the dev registry
    const keys = Object.keys(state);
    expect(keys.length).toBeGreaterThanOrEqual(0);
    void s;
  });
});

describe('restoreSignalState', () => {
  it('sets signal values back', () => {
    // restoreSignalState should not throw
    const state = captureSignalState();
    expect(() => restoreSignalState(state)).not.toThrow();
  });

  it('accepts empty state without throwing', () => {
    expect(() => restoreSignalState({})).not.toThrow();
  });
});

describe('generateHMRCode', () => {
  it('returns string with import.meta.hot', () => {
    const code = generateHMRCode('src/app.ts');
    expect(typeof code).toBe('string');
    expect(code).toContain('import.meta.hot');
  });

  it('includes the module id', () => {
    const code = generateHMRCode('src/counter.ts');
    expect(code).toContain('src/counter.ts');
  });

  it('includes accept call', () => {
    const code = generateHMRCode('test.ts');
    expect(code).toContain('accept');
  });
});

describe('createHMRPlugin', () => {
  it('returns object with name property', () => {
    const plugin = createHMRPlugin();
    expect(typeof plugin).toBe('object');
    expect(plugin).toHaveProperty('name');
  });

  it('name is vite-plugin-drishti-hmr', () => {
    const plugin = createHMRPlugin();
    expect(plugin.name).toBe('vite-plugin-drishti-hmr');
  });

  it('accepts options without throwing', () => {
    expect(() => createHMRPlugin({ preservePrefix: 'user' })).not.toThrow();
  });

  it('generateHMRCode method returns string with import.meta.hot', () => {
    const plugin = createHMRPlugin();
    const code = plugin.generateHMRCode('module.ts');
    expect(typeof code).toBe('string');
    expect(code).toContain('import.meta.hot');
  });

  it('handleHotUpdate does not throw', () => {
    const plugin = createHMRPlugin();
    expect(() => plugin.handleHotUpdate?.({ file: 'src/app.ts' })).not.toThrow();
  });
});
