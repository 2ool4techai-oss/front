import { signal, effect } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

export interface TabItem {
  key:       string;
  label:     string;
  icon?:     string;
  badge?:    string | number | Signal<string | number>;
  disabled?: boolean;
  content:   HTMLElement | (() => HTMLElement);
}

export type TabsVariant = 'line' | 'pill' | 'card';

export interface TabsProps {
  tabs:         TabItem[];
  active?:      Signal<string>;
  variant?:     TabsVariant;
  onChange?:    (key: string) => void;
  class?:       string;
  lazy?:        boolean;   // only render tab content when first activated
}

injectTabsStyles();

export function Tabs(props: TabsProps): HTMLDivElement {
  const variant = props.variant ?? 'line';
  const _active = props.active ?? signal(props.tabs[0]?.key ?? '');
  const rendered = new Set<string>();

  const root = document.createElement('div');
  root.className = `dr-tabs dr-tabs--${variant}${props.class ? ` ${props.class}` : ''}`;
  root.setAttribute('data-dr-tabs', '');

  // ── Tab bar ─────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.className = 'dr-tabs__bar';
  bar.setAttribute('role', 'tablist');
  root.appendChild(bar);

  const buttons: Map<string, HTMLButtonElement> = new Map();

  props.tabs.forEach((tab) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dr-tabs__tab${tab.disabled ? ' dr-tabs__tab--disabled' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('aria-controls', `dr-tab-panel-${tab.key}`);
    btn.id = `dr-tab-${tab.key}`;
    if (tab.disabled) btn.disabled = true;

    if (tab.icon) {
      const ic = document.createElement('span');
      ic.className = 'dr-tabs__tab-icon';
      ic.innerHTML = tab.icon;
      btn.appendChild(ic);
    }

    const labelSpan = document.createElement('span');
    labelSpan.textContent = tab.label;
    btn.appendChild(labelSpan);

    if (tab.badge !== undefined) {
      const badge = document.createElement('span');
      badge.className = 'dr-tabs__badge';
      if (typeof tab.badge === 'function') {
        effect(() => { badge.textContent = String((tab.badge as Signal<string|number>)()); });
      } else {
        badge.textContent = String(tab.badge);
      }
      btn.appendChild(badge);
    }

    btn.addEventListener('click', () => activate(tab.key));
    buttons.set(tab.key, btn);
    bar.appendChild(btn);
  });

  // ── Ink bar (for line variant) ──────────────────────────────────────
  let inkBar: HTMLDivElement | null = null;
  if (variant === 'line') {
    inkBar = document.createElement('div');
    inkBar.className = 'dr-tabs__ink';
    bar.appendChild(inkBar);
  }

  // ── Panels ──────────────────────────────────────────────────────────
  const panels = document.createElement('div');
  panels.className = 'dr-tabs__panels';
  root.appendChild(panels);

  props.tabs.forEach((tab) => {
    const panel = document.createElement('div');
    panel.className = 'dr-tabs__panel';
    panel.id = `dr-tab-panel-${tab.key}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `dr-tab-${tab.key}`);
    panel.hidden = true;

    if (!props.lazy) {
      const content = typeof tab.content === 'function' ? tab.content() : tab.content;
      panel.appendChild(content);
      rendered.add(tab.key);
    }

    panels.appendChild(panel);
  });

  // ── Activate ────────────────────────────────────────────────────────
  function activate(key: string): void {
    _active.set(key);
    props.onChange?.(key);
  }

  effect(() => {
    const active = _active();
    buttons.forEach((btn, key) => {
      const isActive = key === active;
      btn.classList.toggle('dr-tabs__tab--active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });

    // Show/hide panels
    const allPanels = panels.querySelectorAll<HTMLDivElement>('.dr-tabs__panel');
    allPanels.forEach((p) => {
      const key = p.id.replace('dr-tab-panel-', '');
      p.hidden = key !== active;

      // Lazy render
      if (key === active && props.lazy && !rendered.has(key)) {
        rendered.add(key);
        const tab = props.tabs.find(t => t.key === key);
        if (tab) {
          const content = typeof tab.content === 'function' ? tab.content() : tab.content;
          p.appendChild(content);
        }
      }

      if (key === active) p.classList.add('dr-tabs__panel--enter');
    });

    // Move ink bar
    if (inkBar) {
      const activeBtn = buttons.get(active);
      if (activeBtn) {
        const barRect = bar.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        inkBar.style.transform = `translateX(${btnRect.left - barRect.left}px)`;
        inkBar.style.width     = `${btnRect.width}px`;
      }
    }
  });

  // Init ink bar position after layout
  requestAnimationFrame(() => {
    const activeBtn = buttons.get(_active.peek());
    if (inkBar && activeBtn) {
      inkBar.style.transition = 'none';
      const barRect = bar.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      inkBar.style.transform = `translateX(${btnRect.left - barRect.left}px)`;
      inkBar.style.width     = `${btnRect.width}px`;
      requestAnimationFrame(() => { if (inkBar) inkBar.style.transition = ''; });
    }
  });

  return root;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectTabsStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'tabs';
  s.textContent = `
.dr-tabs { display:flex; flex-direction:column; }
.dr-tabs__bar { display:flex; align-items:center; position:relative; gap:2px; }

/* Line variant */
.dr-tabs--line .dr-tabs__bar { border-bottom:1px solid var(--dr-color-border,rgba(255,255,255,.1)); padding-bottom:0; gap:0; }
.dr-tabs--line .dr-tabs__tab { background:transparent; border:none; padding:9px 16px; color:var(--dr-color-text-muted,#64748b); font-family:var(--dr-font-family,system-ui); font-size:.875rem; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; transition:color calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease; display:flex; align-items:center; gap:6px; white-space:nowrap; }
.dr-tabs--line .dr-tabs__tab:hover:not(:disabled) { color:var(--dr-color-text,#e2e8f0); }
.dr-tabs--line .dr-tabs__tab--active { color:var(--dr-color-primary,#3b82f6); }
.dr-tabs__ink { position:absolute; bottom:-1px; left:0; height:2px; background:var(--dr-color-primary,#3b82f6); border-radius:2px 2px 0 0; transition:transform calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) cubic-bezier(.4,0,.2,1), width calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) cubic-bezier(.4,0,.2,1); }

/* Pill variant */
.dr-tabs--pill .dr-tabs__bar { background:rgba(0,0,0,.2); border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1)+4px); padding:3px; gap:2px; }
.dr-tabs--pill .dr-tabs__tab { background:transparent; border:none; padding:6px 16px; color:var(--dr-color-text-muted,#64748b); font-family:var(--dr-font-family,system-ui); font-size:.85rem; font-weight:500; cursor:pointer; border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1)); transition:all calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease; display:flex; align-items:center; gap:6px; white-space:nowrap; }
.dr-tabs--pill .dr-tabs__tab:hover:not(:disabled) { color:var(--dr-color-text,#e2e8f0); background:rgba(255,255,255,.06); }
.dr-tabs--pill .dr-tabs__tab--active { background:var(--dr-color-surface-high,#10101e); color:var(--dr-color-text,#e2e8f0); box-shadow:0 1px 4px rgba(0,0,0,.3); }

/* Card variant */
.dr-tabs--card .dr-tabs__bar { gap:4px; }
.dr-tabs--card .dr-tabs__tab { background:rgba(0,0,0,.2); border:1px solid transparent; padding:8px 16px; color:var(--dr-color-text-muted,#64748b); font-family:var(--dr-font-family,system-ui); font-size:.875rem; font-weight:500; cursor:pointer; border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1)) calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1)) 0 0; transition:all calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease; display:flex; align-items:center; gap:6px; }
.dr-tabs--card .dr-tabs__tab--active { background:var(--dr-color-surface,#0d0d1a); border-color:var(--dr-color-border,rgba(255,255,255,.1)) var(--dr-color-border,rgba(255,255,255,.1)) var(--dr-color-surface,#0d0d1a); color:var(--dr-color-text,#e2e8f0); }

/* Common tab states */
.dr-tabs__tab--disabled { opacity:.4; cursor:not-allowed; }
.dr-tabs__tab-icon { display:flex; width:16px; height:16px; flex-shrink:0; }
.dr-tabs__tab-icon svg { width:16px; height:16px; }
.dr-tabs__badge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px; border-radius:9999px; font-size:.65rem; font-weight:700; background:var(--dr-color-primary,#3b82f6); color:#fff; }

/* Panels */
.dr-tabs__panels { flex:1; }
.dr-tabs__panel { display:none; }
.dr-tabs__panel:not([hidden]) { display:block; animation:dr-tab-in calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.7) cubic-bezier(.34,1.56,.64,1) both; }
@keyframes dr-tab-in { from { opacity:0; transform:translateY(8px) scale(.99); } to { opacity:1; transform:none; } }
`;
  document.head.appendChild(s);
}
