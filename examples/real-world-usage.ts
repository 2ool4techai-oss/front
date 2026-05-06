/**
 * DRISHTI — Real World Usage Example
 *
 * This shows how a developer uses DRISHTI in a real project.
 * Compare to React: no JSX, no useState, no useEffect, no re-renders.
 * Everything is a signal. Everything is reactive by default.
 */

import {
  signal, computed, effect,
  loadGenome,
  EmotionProcessor,
  HealingMonitor,
  connect,
  sanitizeInput,
  mesh,
  h, show, each, mount,
} from '@drishti/runtime';

// ─── 1. Brand DNA — loaded once, inherited by every component ─────────────
loadGenome({
  primaryColor:    '#2D6BE4',
  secondaryColor:  '#1A1A2E',
  accentColor:     '#E94560',
  fontFamily:      'Inter, system-ui, sans-serif',
  fontSizeBase:    '16px',
  spacingUnit:     '8px',
  borderRadius:    '8px',
  shadowElevation: '0 2px 8px rgba(0,0,0,.1)',
  transitionSpeed: '200ms',
  transitionEasing:'cubic-bezier(0.4,0,0.2,1)',
});

// ─── 2. Security — set logged-in user once at app boot ────────────────────
mesh.setUser({ id: '123', name: 'Naveen', roles: ['manager'] });

// ─── 3. App State — plain signals, no store boilerplate ───────────────────
interface Order {
  id: string;
  customer: string;
  amount: number;
  status: 'pending' | 'shipped' | 'delivered';
}

const orders       = signal<Order[]>([]);
const searchQuery  = signal('');
const selectedId   = signal<string | null>(null);
const loading      = signal(true);

// Derived state — recomputes only when orders or searchQuery changes
const filteredOrders = computed(() => {
  const q = searchQuery().toLowerCase();
  return orders().filter(o =>
    o.customer.toLowerCase().includes(q) ||
    o.status.includes(q)
  );
});

const totalRevenue = computed(() =>
  orders().reduce((sum, o) => sum + o.amount, 0)
);

// ─── 4. Data — unified connector, works for REST / WebSocket / SSE ────────
const ordersData = connect<Order[]>('/api/orders');

ordersData.data.subscribe(data => {
  if (data) { orders.set(data); loading.set(false); }
});
ordersData.status.subscribe(s => {
  if (s === 'error') loading.set(false);
});

// ─── 5. Components — plain functions returning HTMLElement ────────────────

function OrderCard(order: () => Order): HTMLElement {
  const card = h('div', {
    style: {
      padding: '16px',
      background: '#fff',
      borderRadius: 'var(--dr-border-radius)',
      boxShadow: 'var(--dr-shadow)',
      cursor: 'pointer',
      transition: 'transform var(--dr-transition-speed)',
    },
  });

  // Reactive text — only this text node updates when order changes
  const customerEl = document.createElement('p');
  customerEl.style.cssText = 'font-weight:600;margin:0 0 4px;';
  effect(() => { customerEl.textContent = order().customer; });

  const amountEl = document.createElement('p');
  amountEl.style.cssText = 'color:var(--dr-color-primary);font-size:1.25rem;font-weight:700;margin:0;';
  effect(() => { amountEl.textContent = `₹${order().amount.toLocaleString()}`; });

  const statusEl = document.createElement('span');
  statusEl.style.cssText = 'font-size:.75rem;padding:2px 8px;border-radius:9999px;font-weight:600;';
  effect(() => {
    const s = order().status;
    statusEl.textContent = s;
    statusEl.style.background = s === 'delivered' ? '#dcfce7' : s === 'shipped' ? '#dbeafe' : '#fef3c7';
    statusEl.style.color      = s === 'delivered' ? '#15803d' : s === 'shipped' ? '#1d4ed8' : '#92400e';
  });

  card.addEventListener('click', () => selectedId.set(order().id));
  card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });

  card.appendChild(customerEl);
  card.appendChild(amountEl);
  card.appendChild(statusEl);
  return card;
}

function SearchBar(): HTMLElement {
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Search orders…';
  input.style.cssText = `
    width: 100%; padding: 10px 14px;
    border: 1.5px solid #e2e8f0; border-radius: var(--dr-border-radius);
    font-size: 1rem; font-family: var(--dr-font-family); outline: none;
    transition: border-color var(--dr-transition-speed);
    box-sizing: border-box;
  `;
  input.addEventListener('input', () => searchQuery.set(sanitizeInput(input.value)));
  input.addEventListener('focus', () => { input.style.borderColor = 'var(--dr-color-primary)'; });
  input.addEventListener('blur',  () => { input.style.borderColor = '#e2e8f0'; });
  return input;
}

function RevenueHeader(): HTMLElement {
  const wrap = h('div', { style: { marginBottom: '24px' } });

  const title = document.createElement('h1');
  title.style.cssText = 'font-size:1.5rem;font-weight:800;color:var(--dr-color-secondary);margin:0 0 4px;';
  title.textContent = 'Orders';

  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:#64748b;margin:0;font-size:.875rem;';

  // Reactive subtitle — updates when totalRevenue or filteredOrders changes
  effect(() => {
    subtitle.textContent =
      `${filteredOrders().length} orders · ₹${totalRevenue().toLocaleString()} total`;
  });

  wrap.appendChild(title);
  wrap.appendChild(subtitle);
  return wrap;
}

function EmptyState(): HTMLElement {
  const el = h('div', { style: 'text-align:center;padding:48px;color:#94a3b8;' });
  el.innerHTML = '<p style="font-size:2rem">📭</p><p>No orders found</p>';
  return el;
}

// ─── 6. Root App — wires everything together ──────────────────────────────

function App(container: HTMLElement): () => void {
  const root = h('div', {
    style: {
      maxWidth: '900px',
      margin: '0 auto',
      padding: '32px 24px',
      fontFamily: 'var(--dr-font-family)',
    },
  });

  root.appendChild(RevenueHeader());
  root.appendChild(SearchBar());

  const grid = h('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '16px',
      marginTop: '20px',
    },
  });

  // Loading skeleton
  const skeletonWrap = h('div', { style: 'display:flex;flex-direction:column;gap:12px;' });
  for (let i = 0; i < 3; i++) {
    const sk = document.createElement('div');
    sk.style.cssText = 'height:90px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;border-radius:8px;animation:dr-shimmer 1.4s infinite;';
    skeletonWrap.appendChild(sk);
  }

  // Reactive show/hide — no manual DOM manipulation needed
  root.appendChild(show(
    () => loading(),
    () => skeletonWrap,
    () => {
      // Reactive list — each card updates independently when its order changes
      const anchor = each(
        () => filteredOrders(),
        (order) => order.id,
        (orderSignal) => OrderCard(() => orderSignal()),
      );

      const wrapper = h('div');

      // Empty state when no results
      wrapper.appendChild(anchor);
      wrapper.appendChild(show(
        () => !loading() && filteredOrders().length === 0,
        EmptyState,
      ));

      grid.appendChild(wrapper);
      return grid;
    },
  ));

  root.appendChild(grid);

  // ── Emotion tracking — starts after paint, zero cost if not needed ──────
  const processor = new EmotionProcessor(root);
  effect(() => {
    const emotion = processor.state();
    if (emotion === 'frustrated') {
      // Make text larger when user is frustrated
      root.style.setProperty('--dr-font-size-base', '17px');
    } else {
      root.style.setProperty('--dr-font-size-base', '16px');
    }
  });

  container.appendChild(root);

  return () => {
    processor.destroy();
    ordersData.destroy();
    root.remove();
  };
}

// ─── 7. Mount ─────────────────────────────────────────────────────────────
const cleanup = App(document.getElementById('app')!);

// cleanup() unmounts everything when navigating away (SPA routing)
window.addEventListener('beforeunload', cleanup);
