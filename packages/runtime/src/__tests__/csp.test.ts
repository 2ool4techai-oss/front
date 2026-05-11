import { describe, it, expect } from 'vitest';
import { createCSP } from '../csp.js';

describe('createCSP', () => {
  it('returns a handle', () => {
    const csp = createCSP();
    expect(csp).toBeDefined();
    expect(typeof csp.getNonce).toBe('function');
    expect(typeof csp.generateNonce).toBe('function');
    expect(typeof csp.buildHeader).toBe('function');
    expect(typeof csp.buildMetaTag).toBe('function');
    expect(typeof csp.injectNonce).toBe('function');
  });

  it('getNonce returns a string', () => {
    const csp = createCSP();
    const nonce = csp.getNonce();
    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('getNonce returns the same value on repeated calls', () => {
    const csp = createCSP();
    const n1 = csp.getNonce();
    const n2 = csp.getNonce();
    const n3 = csp.getNonce();
    expect(n1).toBe(n2);
    expect(n2).toBe(n3);
  });

  it('generateNonce returns different values each call', () => {
    const csp = createCSP();
    const n1 = csp.generateNonce();
    const n2 = csp.generateNonce();
    // Extremely unlikely to be equal
    expect(n1).not.toBe(n2);
  });

  it('buildHeader contains default-src', () => {
    const csp = createCSP();
    const header = csp.buildHeader();
    expect(header).toContain('default-src');
  });

  it('buildMetaTag starts with <meta', () => {
    const csp = createCSP();
    const tag = csp.buildMetaTag();
    expect(tag.startsWith('<meta')).toBe(true);
  });

  it('buildMetaTag contains the header content', () => {
    const csp = createCSP();
    const header = csp.buildHeader();
    const tag = csp.buildMetaTag();
    expect(tag).toContain(header);
  });

  it('injectNonce adds nonce to script elements in container', () => {
    const csp = createCSP();
    const container = document.createElement('div');
    const script = document.createElement('script');
    container.appendChild(script);
    csp.injectNonce(container);
    const nonce = csp.getNonce();
    expect(script.getAttribute('nonce')).toBe(nonce);
  });
});
