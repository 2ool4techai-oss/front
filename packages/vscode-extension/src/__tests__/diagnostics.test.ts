import { describe, it, expect } from 'vitest';
import { runDiagnostics, DRISHTI_DIAGNOSTIC_RULES } from '../diagnostics.js';

describe('runDiagnostics', () => {
  it('returns empty array for clean code', () => {
    const result = runDiagnostics('const x = 1;');
    expect(result).toHaveLength(0);
  });

  it('returns array of DiagnosticMatch objects', () => {
    const result = runDiagnostics(`
      const s = signal(0);
      effect(() => {
        window.addEventListener('click', () => {});
      });
    `);
    expect(Array.isArray(result)).toBe(true);
  });

  it('missing-effect-cleanup fires on addEventListener without return', () => {
    const code = `
effect(() => {
  window.addEventListener('click', handler);
});
    `;
    const results = runDiagnostics(code);
    const match = results.find(r => r.ruleId === 'missing-effect-cleanup');
    expect(match).toBeDefined();
  });

  it('missing-effect-cleanup does not fire when return present', () => {
    const code = `
effect(() => {
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
});
    `;
    const results = runDiagnostics(code);
    const match = results.find(r => r.ruleId === 'missing-effect-cleanup');
    expect(match).toBeUndefined();
  });

  it('diagnostic rules all have id, message, severity, check', () => {
    for (const rule of DRISHTI_DIAGNOSTIC_RULES) {
      expect(typeof rule.id).toBe('string');
      expect(typeof rule.message).toBe('string');
      expect(['error', 'warning', 'hint']).toContain(rule.severity);
      expect(typeof rule.check).toBe('function');
    }
  });
});
