import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createErrorTracker } from '../error-tracking.js';
import { signal } from '../signal.js';

describe('createErrorTracker', () => {
  it('returns a handle', () => {
    const tracker = createErrorTracker();
    expect(tracker).toBeDefined();
    expect(typeof tracker.capture).toBe('function');
    expect(typeof tracker.setUser).toBe('function');
    expect(typeof tracker.setTag).toBe('function');
    expect(typeof tracker.flush).toBe('function');
    expect(typeof tracker.destroy).toBe('function');
    tracker.destroy();
  });

  it('errors starts empty', () => {
    const tracker = createErrorTracker();
    expect(tracker.errors).toHaveLength(0);
    tracker.destroy();
  });

  it('capture(Error) adds an entry', () => {
    const tracker = createErrorTracker();
    tracker.capture(new Error('boom'));
    expect(tracker.errors).toHaveLength(1);
    tracker.destroy();
  });

  it('capture(string) adds an entry', () => {
    const tracker = createErrorTracker();
    tracker.capture('something went wrong');
    expect(tracker.errors).toHaveLength(1);
    expect(tracker.errors[0]?.message).toBe('something went wrong');
    tracker.destroy();
  });

  it('entry has timestamp, message, sessionId', () => {
    const tracker = createErrorTracker();
    tracker.capture('test error');
    const entry = tracker.errors[0];
    expect(entry).toBeDefined();
    expect(entry!.message).toBe('test error');
    expect(entry!.timestamp).toBeGreaterThan(0);
    expect(entry!.sessionId).toBeTruthy();
    tracker.destroy();
  });

  it('setUser sets userId on subsequent captures', () => {
    const tracker = createErrorTracker();
    tracker.setUser('user-123');
    tracker.capture('error after setUser');
    expect(tracker.errors[0]?.userId).toBe('user-123');
    tracker.destroy();
  });

  it('setTag adds tag to subsequent captures', () => {
    const tracker = createErrorTracker();
    tracker.setTag('env', 'production');
    tracker.capture('tagged error');
    expect(tracker.errors[0]?.tags['env']).toBe('production');
    tracker.destroy();
  });

  it('beforeSend returning null drops the error', () => {
    const tracker = createErrorTracker({
      beforeSend: () => null,
    });
    tracker.capture('dropped');
    expect(tracker.errors).toHaveLength(0);
    tracker.destroy();
  });

  it('ignorePatterns skips matching errors', () => {
    const tracker = createErrorTracker({
      ignorePatterns: [/ignore me/i],
    });
    tracker.capture('please ignore me');
    tracker.capture('capture this');
    expect(tracker.errors).toHaveLength(1);
    expect(tracker.errors[0]?.message).toBe('capture this');
    tracker.destroy();
  });

  it('destroy() removes event listeners without throwing', () => {
    const tracker = createErrorTracker();
    expect(() => tracker.destroy()).not.toThrow();
  });
});
