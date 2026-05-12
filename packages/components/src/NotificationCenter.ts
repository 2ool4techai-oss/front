// ── NotificationCenter component ───────────────────────────────────────

import { signal, computed } from '@nexoraaidrishti/runtime';
import type { Signal, ComputedSignal } from '@nexoraaidrishti/runtime';

export interface Notification {
  id:        string;
  title:     string;
  body?:     string;
  timestamp: number;
  read:      boolean;
  type?:     'info' | 'success' | 'warning' | 'error';
  action?:   { label: string; onClick: () => void };
}

export interface NotificationCenterOptions {
  maxItems?: number;
  onRead?:   (id: string) => void;
  onClear?:  () => void;
}

export interface NotificationCenterHandle {
  readonly notifications: Signal<Notification[]>;
  readonly unreadCount:   ComputedSignal<number>;
  add(n: Omit<Notification, 'id' | 'timestamp' | 'read'>): void;
  markRead(id: string): void;
  markAllRead(): void;
  remove(id: string): void;
  clear(): void;
  mount(container: HTMLElement): void;
  destroy(): void;
}

// ── Style injection ────────────────────────────────────────────────────

function injectNotifStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-notif-styles')) return;
  const s = document.createElement('style');
  s.id = 'dr-notif-styles';
  s.textContent = `
.dr-notif-center { position: relative; display: inline-block; font-family: var(--dr-font-family, system-ui, sans-serif); }
.dr-notif-bell {
  position: relative; width: 40px; height: 40px; border-radius: 8px;
  background: transparent; border: 1px solid var(--dr-color-border, rgba(255,255,255,.1));
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: var(--dr-color-text, #e2e8f0); font-size: 1.1rem;
  transition: background 150ms;
}
.dr-notif-bell:hover { background: rgba(255,255,255,.06); }
.dr-notif-badge {
  position: absolute; top: -4px; right: -4px;
  background: var(--dr-color-danger, #ef4444); color: #fff;
  border-radius: 9999px; font-size: .65rem; font-weight: 700;
  min-width: 16px; height: 16px; padding: 0 4px;
  display: flex; align-items: center; justify-content: center;
  line-height: 1;
}
.dr-notif-panel {
  position: absolute; top: calc(100% + 8px); right: 0;
  width: 340px; max-height: 420px;
  background: var(--dr-color-surface, #0d0d1a);
  border: 1px solid var(--dr-color-border, rgba(255,255,255,.1));
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,.5);
  z-index: 800;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.dr-notif-panel--hidden { display: none; }
.dr-notif-panel__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dr-color-border, rgba(255,255,255,.08));
  flex-shrink: 0;
}
.dr-notif-panel__title {
  font-size: .875rem; font-weight: 700; color: var(--dr-color-text, #e2e8f0);
  margin: 0;
}
.dr-notif-mark-all {
  font-size: .75rem; color: var(--dr-color-primary, #3b82f6);
  background: none; border: none; cursor: pointer; padding: 0;
}
.dr-notif-mark-all:hover { text-decoration: underline; }
.dr-notif-list { overflow-y: auto; flex: 1; }
.dr-notif-empty {
  padding: 32px 16px; text-align: center;
  color: var(--dr-color-text-muted, #64748b); font-size: .85rem;
}
.dr-notif-item {
  display: flex; gap: 10px; padding: 12px 16px;
  border-bottom: 1px solid var(--dr-color-border, rgba(255,255,255,.05));
  cursor: pointer; transition: background 120ms;
  align-items: flex-start;
}
.dr-notif-item:hover { background: rgba(255,255,255,.04); }
.dr-notif-item--unread { background: rgba(59,130,246,.05); }
.dr-notif-icon {
  flex-shrink: 0; width: 20px; height: 20px; font-size: .9rem;
  display: flex; align-items: center; justify-content: center;
  margin-top: 1px;
}
.dr-notif-icon--info    { color: #3b82f6; }
.dr-notif-icon--success { color: #22c55e; }
.dr-notif-icon--warning { color: #f59e0b; }
.dr-notif-icon--error   { color: #ef4444; }
.dr-notif-body { flex: 1; min-width: 0; }
.dr-notif-title { font-size: .85rem; font-weight: 600; color: var(--dr-color-text, #e2e8f0); margin-bottom: 2px; }
.dr-notif-text { font-size: .78rem; color: var(--dr-color-text-muted, #94a3b8); line-height: 1.4; word-break: break-word; }
.dr-notif-time { font-size: .7rem; color: var(--dr-color-text-muted, #64748b); margin-top: 4px; }
.dr-notif-unread-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--dr-color-primary, #3b82f6);
  flex-shrink: 0; margin-top: 6px;
}
.dr-notif-action {
  font-size: .75rem; color: var(--dr-color-primary, #3b82f6);
  background: none; border: none; cursor: pointer; padding: 0; margin-top: 4px; display: block;
}
.dr-notif-action:hover { text-decoration: underline; }
`;
  document.head.appendChild(s);
}

// ── Time ago helper ────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (secs < 60)  return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const TYPE_ICONS: Record<string, string> = {
  info:    'ℹ',
  success: '✓',
  warning: '⚠',
  error:   '✕',
};

// ── createNotificationCenter ───────────────────────────────────────────

export function createNotificationCenter(opts?: NotificationCenterOptions): NotificationCenterHandle {
  if (typeof document !== 'undefined') injectNotifStyles();

  const maxItems    = opts?.maxItems ?? 50;
  const notifsSig   = signal<Notification[]>([]);
  const unreadCount = computed(() => notifsSig().filter(n => !n.read).length);

  let root: HTMLElement | null = null;
  let listEl: HTMLElement | null = null;
  let badgeEl: HTMLElement | null = null;
  let panelEl: HTMLElement | null = null;
  let panelOpen = false;

  function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2);
  }

  function renderList(): void {
    if (!listEl) return;
    listEl.innerHTML = '';
    const notifs = notifsSig.peek();
    if (notifs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dr-notif-empty';
      empty.textContent = 'No notifications';
      listEl.appendChild(empty);
      return;
    }
    for (const notif of [...notifs].reverse()) {
      const item = document.createElement('div');
      item.className = `dr-notif-item${notif.read ? '' : ' dr-notif-item--unread'}`;
      item.dataset['id'] = notif.id;

      // Icon
      if (notif.type !== undefined) {
        const iconEl = document.createElement('div');
        iconEl.className = `dr-notif-icon dr-notif-icon--${notif.type}`;
        iconEl.textContent = TYPE_ICONS[notif.type] ?? '';
        item.appendChild(iconEl);
      }

      // Body
      const bodyEl = document.createElement('div');
      bodyEl.className = 'dr-notif-body';

      const titleEl = document.createElement('div');
      titleEl.className = 'dr-notif-title';
      titleEl.textContent = notif.title;
      bodyEl.appendChild(titleEl);

      if (notif.body !== undefined) {
        const textEl = document.createElement('div');
        textEl.className = 'dr-notif-text';
        textEl.textContent = notif.body;
        bodyEl.appendChild(textEl);
      }

      const timeEl = document.createElement('div');
      timeEl.className = 'dr-notif-time';
      timeEl.textContent = timeAgo(notif.timestamp);
      bodyEl.appendChild(timeEl);

      if (notif.action !== undefined) {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'dr-notif-action';
        actionBtn.textContent = notif.action.label;
        const action = notif.action;
        actionBtn.addEventListener('click', (e) => { e.stopPropagation(); action.onClick(); });
        bodyEl.appendChild(actionBtn);
      }

      item.appendChild(bodyEl);

      // Unread dot
      if (!notif.read) {
        const dot = document.createElement('div');
        dot.className = 'dr-notif-unread-dot';
        item.appendChild(dot);
      }

      item.addEventListener('click', () => {
        handle.markRead(notif.id);
      });

      listEl.appendChild(item);
    }
  }

  function updateBadge(): void {
    if (!badgeEl) return;
    const count = unreadCount();
    if (count > 0) {
      badgeEl.textContent = count > 99 ? '99+' : String(count);
      badgeEl.style.display = 'flex';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  // Subscribe to signal changes
  notifsSig.subscribe(() => {
    renderList();
    updateBadge();
  });

  const handle: NotificationCenterHandle = {
    get notifications() { return notifsSig; },
    get unreadCount()   { return unreadCount; },

    add(n: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
      const newNotif: Notification = {
        ...n,
        id:        genId(),
        timestamp: Date.now(),
        read:      false,
      };
      const current = notifsSig.peek();
      const next = [newNotif, ...current].slice(0, maxItems);
      notifsSig.set(next);
    },

    markRead(id: string): void {
      const next = notifsSig.peek().map(n =>
        n.id === id ? { ...n, read: true } : n,
      );
      notifsSig.set(next);
      opts?.onRead?.(id);
    },

    markAllRead(): void {
      const next = notifsSig.peek().map(n => ({ ...n, read: true }));
      notifsSig.set(next);
    },

    remove(id: string): void {
      notifsSig.set(notifsSig.peek().filter(n => n.id !== id));
    },

    clear(): void {
      notifsSig.set([]);
      opts?.onClear?.();
    },

    mount(container: HTMLElement): void {
      if (typeof document !== 'undefined') injectNotifStyles();
      root = document.createElement('div');
      root.className = 'dr-notif-center';

      // Bell button
      const bell = document.createElement('button');
      bell.className = 'dr-notif-bell';
      bell.setAttribute('aria-label', 'Notifications');
      bell.innerHTML = '&#x1F514;'; // 🔔

      badgeEl = document.createElement('div');
      badgeEl.className = 'dr-notif-badge';
      badgeEl.style.display = 'none';
      bell.appendChild(badgeEl);
      root.appendChild(bell);

      // Panel
      panelEl = document.createElement('div');
      panelEl.className = 'dr-notif-panel dr-notif-panel--hidden';

      const header = document.createElement('div');
      header.className = 'dr-notif-panel__header';

      const titleEl = document.createElement('h3');
      titleEl.className = 'dr-notif-panel__title';
      titleEl.textContent = 'Notifications';
      header.appendChild(titleEl);

      const markAllBtn = document.createElement('button');
      markAllBtn.className = 'dr-notif-mark-all';
      markAllBtn.textContent = 'Mark all read';
      markAllBtn.addEventListener('click', () => handle.markAllRead());
      header.appendChild(markAllBtn);

      panelEl.appendChild(header);

      listEl = document.createElement('div');
      listEl.className = 'dr-notif-list';
      panelEl.appendChild(listEl);

      root.appendChild(panelEl);

      // Toggle panel on bell click
      bell.addEventListener('click', (e) => {
        e.stopPropagation();
        panelOpen = !panelOpen;
        if (panelOpen) {
          panelEl!.classList.remove('dr-notif-panel--hidden');
          renderList();
        } else {
          panelEl!.classList.add('dr-notif-panel--hidden');
        }
      });

      // Close on outside click
      document.addEventListener('click', () => {
        if (panelOpen) {
          panelOpen = false;
          panelEl!.classList.add('dr-notif-panel--hidden');
        }
      });

      container.appendChild(root);
      updateBadge();
      renderList();
    },

    destroy(): void {
      if (root) {
        root.remove();
        root = null;
      }
      listEl  = null;
      badgeEl = null;
      panelEl = null;
    },
  };

  return handle;
}
