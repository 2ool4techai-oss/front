import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAttentionTracker } from '../attention.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function makeElement(): HTMLElement {
  return document.createElement('div');
}

describe('createAttentionTracker', () => {
  it('attention() returns null for untracked element', () => {
    const tracker = createAttentionTracker();
    expect(tracker.attention('unknown')).toBeNull();
  });

  it('track() returns a cleanup function', () => {
    const tracker = createAttentionTracker();
    const el = makeElement();
    const cleanup = tracker.track(el, 'el1');
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('track() registers element and creates an entry', () => {
    const tracker = createAttentionTracker();
    const el = makeElement();
    tracker.track(el, 'el1');
    const entry = tracker.attention('el1');
    expect(entry).not.toBeNull();
    expect(entry!.visits).toBe(0);
    expect(entry!.totalDwell).toBe(0);
  });

  it('mouseenter increments visit count', () => {
    const tracker = createAttentionTracker({ dwellThreshold: 800 });
    const el = makeElement();
    document.body.appendChild(el);
    tracker.track(el, 'el1');

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tracker.attention('el1')!.visits).toBe(1);

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tracker.attention('el1')!.visits).toBe(2);
    document.body.removeChild(el);
  });

  it('dwell time accumulates when hover exceeds threshold', () => {
    const tracker = createAttentionTracker({ dwellThreshold: 500 });
    const el = makeElement();
    document.body.appendChild(el);
    tracker.track(el, 'el2');

    el.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(600);
    el.dispatchEvent(new MouseEvent('mouseleave'));

    expect(tracker.attention('el2')!.totalDwell).toBeGreaterThanOrEqual(500);
    document.body.removeChild(el);
  });

  it('dwell time NOT counted when hover is below threshold', () => {
    const tracker = createAttentionTracker({ dwellThreshold: 1000 });
    const el = makeElement();
    document.body.appendChild(el);
    tracker.track(el, 'el3');

    el.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(200);
    el.dispatchEvent(new MouseEvent('mouseleave'));

    expect(tracker.attention('el3')!.totalDwell).toBe(0);
    document.body.removeChild(el);
  });

  it('topElements() returns sorted array by score', () => {
    const tracker = createAttentionTracker({ dwellThreshold: 100 });
    const el1 = makeElement();
    const el2 = makeElement();
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    tracker.track(el1, 'a');
    tracker.track(el2, 'b');

    // Give 'a' more dwell time
    el1.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(2000);
    el1.dispatchEvent(new MouseEvent('mouseleave'));

    const top = tracker.topElements(2);
    expect(top[0]!.id).toBe('a');
    expect(top[0]!.score).toBeGreaterThan(top[1]!.score);

    document.body.removeChild(el1);
    document.body.removeChild(el2);
  });

  it('topElements() with n limits results', () => {
    const tracker = createAttentionTracker();
    for (let i = 0; i < 5; i++) {
      const el = makeElement();
      tracker.track(el, `el${i}`);
    }
    const top = tracker.topElements(3);
    expect(top.length).toBeLessThanOrEqual(3);
  });

  it('clear() removes all entries', () => {
    const tracker = createAttentionTracker();
    const el = makeElement();
    tracker.track(el, 'clearme');
    tracker.clear();
    expect(tracker.attention('clearme')).toBeNull();
    expect(tracker.topElements()).toHaveLength(0);
  });

  it('cleanup function removes event listeners', () => {
    const tracker = createAttentionTracker({ dwellThreshold: 100 });
    const el = makeElement();
    document.body.appendChild(el);
    const cleanup = tracker.track(el, 'clean');

    cleanup();

    // After cleanup, events should not update the entry (entry may still exist)
    el.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(500);
    el.dispatchEvent(new MouseEvent('mouseleave'));
    // visits should remain 0 since cleanup removed the listener
    const entry = tracker.attention('clean');
    expect(entry?.visits ?? 0).toBe(0);
    document.body.removeChild(el);
  });
});
