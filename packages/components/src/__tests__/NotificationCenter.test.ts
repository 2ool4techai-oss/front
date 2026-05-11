import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createNotificationCenter } from '../NotificationCenter.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createNotificationCenter', () => {
  it('starts with empty notifications', () => {
    const nc = createNotificationCenter();
    expect(nc.notifications()).toHaveLength(0);
  });

  it('add() appends notification', () => {
    const nc = createNotificationCenter();
    nc.add({ title: 'Hello', type: 'info' });
    expect(nc.notifications()).toHaveLength(1);
    expect(nc.notifications()[0]!.title).toBe('Hello');
  });

  it('unreadCount reflects unread items', () => {
    const nc = createNotificationCenter();
    expect(nc.unreadCount()).toBe(0);
    nc.add({ title: 'A', type: 'info' });
    nc.add({ title: 'B', type: 'success' });
    expect(nc.unreadCount()).toBe(2);
  });

  it('markRead() sets read=true', () => {
    const nc = createNotificationCenter();
    nc.add({ title: 'Read me', type: 'info' });
    const id = nc.notifications()[0]!.id;
    expect(nc.notifications()[0]!.read).toBe(false);
    nc.markRead(id);
    expect(nc.notifications()[0]!.read).toBe(true);
    expect(nc.unreadCount()).toBe(0);
  });

  it('markAllRead() marks all read', () => {
    const nc = createNotificationCenter();
    nc.add({ title: 'A' });
    nc.add({ title: 'B' });
    nc.add({ title: 'C' });
    expect(nc.unreadCount()).toBe(3);
    nc.markAllRead();
    expect(nc.unreadCount()).toBe(0);
    expect(nc.notifications().every(n => n.read)).toBe(true);
  });

  it('remove() deletes by id', () => {
    const nc = createNotificationCenter();
    nc.add({ title: 'Keep' });
    nc.add({ title: 'Delete me' });
    const deleteId = nc.notifications()[0]!.id; // newest is first
    nc.remove(deleteId);
    expect(nc.notifications()).toHaveLength(1);
    expect(nc.notifications()[0]!.title).toBe('Keep');
  });

  it('clear() empties list', () => {
    const nc = createNotificationCenter();
    nc.add({ title: 'A' });
    nc.add({ title: 'B' });
    nc.clear();
    expect(nc.notifications()).toHaveLength(0);
  });

  it('maxItems cap enforced', () => {
    const nc = createNotificationCenter({ maxItems: 3 });
    for (let i = 0; i < 5; i++) {
      nc.add({ title: `Notif ${i}` });
    }
    expect(nc.notifications()).toHaveLength(3);
  });
});
