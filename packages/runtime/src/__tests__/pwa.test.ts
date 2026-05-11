import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPWA, createOfflineQueue } from '../pwa.js';

describe('createPWA', () => {
  it('returns a handle', () => {
    const pwa = createPWA();
    expect(pwa).toBeDefined();
    expect(typeof pwa.registerSW).toBe('function');
    expect(typeof pwa.skipWaiting).toBe('function');
    expect(typeof pwa.destroy).toBe('function');
    pwa.destroy();
  });

  it('online starts true in jsdom environment', () => {
    const pwa = createPWA();
    // jsdom sets navigator.onLine = true by default
    expect(pwa.online.peek()).toBe(true);
    pwa.destroy();
  });

  it('"offline" event sets online to false', () => {
    const pwa = createPWA();
    window.dispatchEvent(new Event('offline'));
    expect(pwa.online.peek()).toBe(false);
    pwa.destroy();
  });

  it('"online" event sets online to true', () => {
    const pwa = createPWA();
    // First go offline
    window.dispatchEvent(new Event('offline'));
    expect(pwa.online.peek()).toBe(false);
    // Then back online
    window.dispatchEvent(new Event('online'));
    expect(pwa.online.peek()).toBe(true);
    pwa.destroy();
  });
});

describe('createOfflineQueue', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('queue starts empty', () => {
    const q = createOfflineQueue<string>({
      onFlush: async () => {},
      storageKey: `__test_queue_${Math.random()}`,
    });
    expect(q.queue.peek()).toHaveLength(0);
    q.destroy();
  });

  it('enqueue adds item to queue', () => {
    const q = createOfflineQueue<string>({
      onFlush: async () => {},
      storageKey: `__test_queue_${Math.random()}`,
    });
    q.enqueue('hello');
    expect(q.queue.peek()).toHaveLength(1);
    expect(q.queue.peek()[0]).toBe('hello');
    q.destroy();
  });

  it('flush calls onFlush with items and clears the queue', async () => {
    const flushed: string[][] = [];
    const q = createOfflineQueue<string>({
      onFlush: async (items) => { flushed.push(items); },
      storageKey: `__test_queue_${Math.random()}`,
    });
    q.enqueue('a');
    q.enqueue('b');
    await q.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toEqual(['a', 'b']);
    expect(q.queue.peek()).toHaveLength(0);
    q.destroy();
  });

  it('clear empties the queue', () => {
    const q = createOfflineQueue<number>({
      onFlush: async () => {},
      storageKey: `__test_queue_${Math.random()}`,
    });
    q.enqueue(1);
    q.enqueue(2);
    q.clear();
    expect(q.queue.peek()).toHaveLength(0);
    q.destroy();
  });
});
