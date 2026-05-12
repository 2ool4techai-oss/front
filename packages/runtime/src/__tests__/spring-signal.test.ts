// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { springSignal } from '../spring-signal.js';

describe('springSignal', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts at initial value', () => {
    const s = springSignal(0);
    expect(s()).toBe(0);
  });

  it('target() updates immediately when set() is called', () => {
    const s = springSignal(0);
    s.set(100);
    expect(s.target()).toBe(100);
  });

  it('settled() is true initially', () => {
    const s = springSignal(0);
    expect(s.settled()).toBe(true);
  });

  it('settled() becomes false when animating', () => {
    const s = springSignal(0);
    s.set(100);
    expect(s.settled()).toBe(false);
  });

  it('stop() settles animation immediately', () => {
    const s = springSignal(0);
    s.set(100);
    s.stop();
    expect(s.settled()).toBe(true);
  });
});
