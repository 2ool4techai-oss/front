import { describe, it, expect, vi } from 'vitest';
import { xssGuardSignal } from '../xss-guard.js';

describe('xssGuardSignal', () => {
  it('stores initial value and returns sanitized output', () => {
    const sig = xssGuardSignal('hello world');
    expect(sig()).toBe('hello world');
  });

  it('strips script tags from value', () => {
    const sig = xssGuardSignal('');
    sig.set('<script>alert("xss")</script>safe text');
    // The sanitized value should not contain the script content as HTML tag
    const sanitized = sig();
    expect(sanitized).not.toContain('<script>');
  });

  it('raw() returns the unsanitized original value', () => {
    const raw = '<img src=x onerror=alert(1)>';
    const sig = xssGuardSignal(raw);
    expect(sig.raw()).toBe(raw);
  });

  it('wasSanitized() returns true when XSS was stripped', () => {
    const sig = xssGuardSignal('');
    sig.set('<script>evil()</script>');
    expect(sig.wasSanitized()).toBe(true);
  });

  it('wasSanitized() returns false for plain text', () => {
    const sig = xssGuardSignal('just plain text');
    expect(sig.wasSanitized()).toBe(false);
  });

  it('peek() returns sanitized value without triggering reactive tracking', () => {
    const sig = xssGuardSignal('<b>bold</b>');
    // With no allowed tags, 'b' tag gets stripped
    const peeked = sig.peek();
    expect(peeked).not.toContain('<b>');
  });

  it('allowedTags option preserves allowed HTML tags', () => {
    const sig = xssGuardSignal('<b>bold</b> and <i>italic</i>', {
      allowedTags: ['b', 'i'],
    });
    const result = sig();
    expect(result).toContain('<b>');
    expect(result).toContain('<i>');
  });

  it('allowedTags does not allow disallowed tags', () => {
    const sig = xssGuardSignal('<b>ok</b><script>bad</script>', {
      allowedTags: ['b'],
    });
    const result = sig();
    expect(result).toContain('<b>');
    expect(result).not.toContain('<script>');
  });

  it('allowedAttrs preserves allowed attributes', () => {
    const sig = xssGuardSignal('<a href="https://example.com">link</a>', {
      allowedTags: ['a'],
      allowedAttrs: ['href'],
    });
    const result = sig();
    expect(result).toContain('href=');
  });

  it('strips disallowed attributes', () => {
    const sig = xssGuardSignal('<a href="/" onclick="evil()">link</a>', {
      allowedTags: ['a'],
      allowedAttrs: ['href'],
    });
    const result = sig();
    expect(result).not.toContain('onclick');
  });

  it('onAttempt callback is called when XSS is stripped', () => {
    const onAttempt = vi.fn();
    const sig = xssGuardSignal('', { onAttempt });
    sig.set('<script>xss</script>');
    expect(onAttempt).toHaveBeenCalledOnce();
    const [rawArg, sanitizedArg] = onAttempt.mock.calls[0];
    expect(rawArg).toContain('<script>');
    expect(sanitizedArg).not.toContain('<script>');
  });

  it('onAttempt is not called for safe input', () => {
    const onAttempt = vi.fn();
    const sig = xssGuardSignal('', { onAttempt });
    sig.set('just plain text');
    expect(onAttempt).not.toHaveBeenCalled();
  });
});
