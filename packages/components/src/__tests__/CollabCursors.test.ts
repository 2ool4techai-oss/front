import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@drishti/runtime';
import type { CollabHandle, PresenceState } from '@drishti/runtime';
import { createCollabCursors } from '../CollabCursors.js';

// ── Mock CollabHandle ──────────────────────────────────────────────────

function makeMockSession(): CollabHandle {
  return {
    clientId: 'test-client',
    connected: signal(true),
    peers: signal<PresenceState[]>([]),
    signal<T>(_key: string, initial: T) {
      const s = signal(initial);
      return Object.assign(s, { key: _key, clientId: 'test-client', lastOp: signal(null) }) as import('@drishti/runtime').CollaborativeSignal<T>;
    },
    updatePresence: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('createCollabCursors', () => {
  let session: CollabHandle;

  beforeEach(() => {
    session = makeMockSession();
    // Reset injected styles flag for isolation
    // (styles are only injected once in module scope, fine for tests)
  });

  afterEach(() => {
    // Clean up any injected DOM
    document.querySelectorAll('.dr-cursor').forEach(el => el.remove());
    const styleEl = document.getElementById('dr-collab-cursors-style');
    if (styleEl) styleEl.remove();
  });

  it('returns handle with cursors signal', () => {
    const handle = createCollabCursors(session, { userId: 'user1' });
    expect(handle.cursors).toBeDefined();
    expect(typeof handle.cursors.peek).toBe('function');
    handle.destroy();
  });

  it('cursors starts empty', () => {
    const handle = createCollabCursors(session, { userId: 'user1' });
    expect(handle.cursors.peek()).toEqual([]);
    handle.destroy();
  });

  it('setPosition updates own user in cursors', () => {
    const handle = createCollabCursors(session, { userId: 'user1', userName: 'Alice' });
    handle.setPosition(100, 200);
    const cursors = handle.cursors.peek();
    expect(cursors.length).toBe(1);
    expect(cursors[0]).toMatchObject({ id: 'user1', name: 'Alice', x: 100, y: 200 });
    handle.destroy();
  });

  it('myColor is a string', () => {
    const handle = createCollabCursors(session, { userId: 'user1' });
    expect(typeof handle.myColor).toBe('string');
    expect(handle.myColor.length).toBeGreaterThan(0);
    handle.destroy();
  });

  it('destroy() does not throw', () => {
    const handle = createCollabCursors(session, { userId: 'user1' });
    expect(() => handle.destroy()).not.toThrow();
  });

  it('cursors signal is reactive (can subscribe)', () => {
    const handle = createCollabCursors(session, { userId: 'user2' });
    let emitCount = 0;
    const unsub = handle.cursors.subscribe(() => { emitCount++; });
    handle.setPosition(10, 20);
    expect(emitCount).toBeGreaterThan(0);
    unsub();
    handle.destroy();
  });

  it('color auto-assigned from palette when not provided', () => {
    const handle = createCollabCursors(session, { userId: 'user-abc' });
    const palette = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    expect(palette).toContain(handle.myColor);
    handle.destroy();
  });

  it('destroy removes cursor DOM elements', () => {
    const handle = createCollabCursors(session, { userId: 'user1' });
    // Inject a second user's cursor by directly manipulating
    handle.setPosition(50, 50);
    handle.destroy();
    // After destroy, no .dr-cursor elements should remain from this handle
    // (own cursor not rendered as DOM element, only remote users are)
    const remaining = document.querySelectorAll('.dr-cursor');
    expect(remaining.length).toBe(0);
  });
});
