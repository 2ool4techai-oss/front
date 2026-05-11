import { describe, it, expect, afterEach } from 'vitest';
import { enableHIPAA } from '../hipaa.js';

afterEach(() => {
  try { enableHIPAA().disable(); } catch { /* ignore */ }
});

describe('enableHIPAA', () => {
  it('returns a handle', () => {
    const h = enableHIPAA();
    expect(h).toBeDefined();
    expect(typeof h.scrub).toBe('function');
    h.disable();
  });

  it('isEnabled() returns true after enable', () => {
    const h = enableHIPAA();
    expect(h.isEnabled()).toBe(true);
    h.disable();
  });

  it('scrub() redacts SSN pattern', () => {
    const h = enableHIPAA();
    expect(h.scrub('SSN: 123-45-6789')).toContain('[SSN REDACTED]');
    h.disable();
  });

  it('scrub() redacts email', () => {
    const h = enableHIPAA();
    expect(h.scrub('contact user@example.com please')).toContain('[EMAIL REDACTED]');
    h.disable();
  });

  it('scrub() redacts phone', () => {
    const h = enableHIPAA();
    expect(h.scrub('call 555-867-5309')).toContain('[PHONE REDACTED]');
    h.disable();
  });

  it('scrub() redacts credit card', () => {
    const h = enableHIPAA();
    expect(h.scrub('card 4111 1111 1111 1111')).toContain('[CARD REDACTED]');
    h.disable();
  });

  it('scrub() leaves clean text unchanged', () => {
    const h = enableHIPAA();
    expect(h.scrub('hello world')).toBe('hello world');
    h.disable();
  });

  it('scrub() with custom pattern', () => {
    const h = enableHIPAA({ scrubPatterns: [/SECRET/g] });
    expect(h.scrub('my SECRET key')).not.toContain('SECRET');
    h.disable();
  });

  it('disable() sets isEnabled to false', () => {
    const h = enableHIPAA();
    h.disable();
    expect(h.isEnabled()).toBe(false);
  });

  it('wrapSignal returns callable proxy', async () => {
    const { signal } = await import('../signal.js');
    const h = enableHIPAA();
    const s = signal('hello');
    const wrapped = h.wrapSignal(s, 'testSig');
    expect(typeof wrapped).toBe('function');
    h.disable();
  });
});
