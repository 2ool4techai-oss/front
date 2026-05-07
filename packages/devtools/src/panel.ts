import { _getDevSignals, _totalEffectRuns } from '@drishti/runtime';
import type { EmotionProcessor, Cache, Router } from '@drishti/runtime';

export interface DevToolsOptions {
  emotion?: EmotionProcessor;
  cache?:   Cache;
  router?:  Router;
  shortcut?: string; // default 'ctrl+shift+d'
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export interface DevToolsHandle {
  show(): void;
  hide(): void;
  toggle(): void;
  destroy(): void;
}

// ── Styles ────────────────────────────────────────────────────────────
const CSS = `
.dr-devtools-root {
  position: fixed;
  z-index: 2147483647;
  font-family: 'Menlo','Monaco','Courier New',monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #e2e8f0;
  --dt-bg: #0f172a;
  --dt-bg2: #1e293b;
  --dt-bg3: #334155;
  --dt-border: #334155;
  --dt-accent: #38bdf8;
  --dt-green: #4ade80;
  --dt-yellow: #fbbf24;
  --dt-red: #f87171;
  --dt-purple: #c084fc;
  --dt-muted: #64748b;
  width: 420px;
  user-select: none;
}
.dr-devtools-root.bottom-right { bottom: 16px; right: 16px; }
.dr-devtools-root.bottom-left  { bottom: 16px; left: 16px; }
.dr-devtools-root.top-right    { top: 16px; right: 16px; }
.dr-devtools-root.top-left     { top: 16px; left: 16px; }
.dr-devtools-root.minimized .dr-dt-body { display: none; }

.dr-dt-panel {
  background: var(--dt-bg);
  border: 1px solid var(--dt-border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,.6);
}
.dr-dt-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--dt-bg2);
  cursor: move;
  border-bottom: 1px solid var(--dt-border);
}
.dr-dt-titlebar-logo {
  font-weight: 700;
  font-size: 12px;
  color: var(--dt-accent);
  letter-spacing: .05em;
  flex: 1;
}
.dr-dt-titlebar-logo span { color: var(--dt-muted); font-weight: 400; }
.dr-dt-pill {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--dt-bg3);
  color: var(--dt-muted);
}
.dr-dt-btn {
  background: none;
  border: none;
  color: var(--dt-muted);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1;
}
.dr-dt-btn:hover { color: #fff; background: var(--dt-bg3); }

.dr-dt-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px 0;
  background: var(--dt-bg2);
  border-bottom: 1px solid var(--dt-border);
}
.dr-dt-tab {
  padding: 4px 10px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  color: var(--dt-muted);
  transition: color .15s, background .15s;
  font-size: 11px;
}
.dr-dt-tab:hover { color: #fff; }
.dr-dt-tab.active { color: var(--dt-accent); background: var(--dt-bg); border-bottom: 2px solid var(--dt-accent); }

.dr-dt-body {
  height: 340px;
  overflow-y: auto;
  padding: 10px 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--dt-bg3) transparent;
}

.dr-dt-section { margin-bottom: 12px; }
.dr-dt-section-title {
  color: var(--dt-muted);
  font-size: 9px;
  letter-spacing: .1em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.dr-dt-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 4px;
  margin-bottom: 2px;
}
.dr-dt-row:hover { background: var(--dt-bg2); }
.dr-dt-row-label { color: var(--dt-muted); min-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dr-dt-row-value { color: #fff; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dr-dt-row-badge { font-size: 9px; padding: 1px 5px; border-radius: 99px; }
.dr-dt-badge-signal   { background: #1e3a5f; color: var(--dt-accent); }
.dr-dt-badge-computed { background: #2d1b69; color: var(--dt-purple); }

.dr-dt-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}
.dr-dt-stat {
  background: var(--dt-bg2);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  padding: 8px;
  text-align: center;
}
.dr-dt-stat-val { font-size: 18px; font-weight: 700; line-height: 1; margin-bottom: 3px; }
.dr-dt-stat-lbl { color: var(--dt-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }

.dr-dt-emotion-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--dt-bg2);
  border-radius: 8px;
  margin-bottom: 8px;
}
.dr-dt-emotion-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dr-dt-emotion-name { font-size: 14px; font-weight: 700; flex: 1; }
.dr-dt-conf-bar {
  width: 100%;
  height: 4px;
  background: var(--dt-bg3);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 4px;
}
.dr-dt-conf-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--dt-accent);
  transition: width .3s;
}

.dr-dt-resource-row {
  display: grid;
  grid-template-columns: 1fr 70px 50px;
  gap: 6px;
  align-items: center;
  padding: 4px 6px;
  border-radius: 4px;
  margin-bottom: 2px;
}
.dr-dt-resource-row:hover { background: var(--dt-bg2); }
.dr-dt-status-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  margin-right: 5px;
}
.dr-dt-status-loading { background: var(--dt-yellow); animation: dr-dt-pulse .8s infinite; }
.dr-dt-status-success { background: var(--dt-green); }
.dr-dt-status-error   { background: var(--dt-red); }
.dr-dt-status-idle    { background: var(--dt-muted); }

.dr-dt-search {
  width: 100%;
  padding: 4px 8px;
  background: var(--dt-bg2);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  margin-bottom: 8px;
  box-sizing: border-box;
  outline: none;
}
.dr-dt-search:focus { border-color: var(--dt-accent); }

@keyframes dr-dt-pulse {
  0%,100% { opacity: 1; }
  50% { opacity: .4; }
}
`;

// ── Emotion colors ─────────────────────────────────────────────────────
const EMOTION_COLOR: Record<string, string> = {
  calm:        '#4ade80',
  engaged:     '#38bdf8',
  focused:     '#c084fc',
  frustrated:  '#f87171',
  confused:    '#fbbf24',
  bored:       '#64748b',
  celebrating: '#fb923c',
};

// ── Panel ──────────────────────────────────────────────────────────────

export function createPanel(opts: DevToolsOptions): DevToolsHandle {
  const pos = opts.position ?? 'bottom-right';

  // Inject CSS once
  if (!document.getElementById('dr-devtools-css')) {
    const style = document.createElement('style');
    style.id = 'dr-devtools-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // Root
  const root = document.createElement('div');
  root.className = `dr-devtools-root ${pos}`;
  document.body.appendChild(root);

  let visible  = true;
  let activeTab = 'overview';
  let signalFilter = '';

  // ── Build DOM ──────────────────────────────────────────────────────
  const panel = el('div', 'dr-dt-panel');
  root.appendChild(panel);

  // Title bar
  const titleBar = el('div', 'dr-dt-titlebar');
  const logo = el('div', 'dr-dt-titlebar-logo');
  logo.innerHTML = 'DRISHTI <span>DevTools</span>';
  const minBtn = btn('_', () => { root.classList.toggle('minimized'); });
  const closeBtn = btn('×', () => hide());
  titleBar.append(logo, minBtn, closeBtn);
  panel.appendChild(titleBar);

  // Tabs
  const tabBar = el('div', 'dr-dt-tabs');
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'signals',  label: 'Signals'  },
    { id: 'emotion',  label: 'Emotion'  },
    { id: 'data',     label: 'Data'     },
  ];
  const tabEls: Record<string, HTMLElement> = {};
  for (const t of TABS) {
    const tabEl = el('div', `dr-dt-tab${t.id === activeTab ? ' active' : ''}`);
    tabEl.textContent = t.label;
    tabEl.addEventListener('click', () => setTab(t.id));
    tabBar.appendChild(tabEl);
    tabEls[t.id] = tabEl;
  }
  panel.appendChild(tabBar);

  // Body
  const body = el('div', 'dr-dt-body');
  panel.appendChild(body);

  // ── Drag ──────────────────────────────────────────────────────────
  let dragging = false;
  let dragOX = 0, dragOY = 0;
  titleBar.addEventListener('mousedown', (e) => {
    dragging = true; dragOX = e.clientX - root.offsetLeft; dragOY = e.clientY - root.offsetTop;
    root.style.transition = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    root.style.left   = `${e.clientX - dragOX}px`;
    root.style.top    = `${e.clientY - dragOY}px`;
    root.style.right  = 'auto';
    root.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // ── Render loop ────────────────────────────────────────────────────
  let ticker: ReturnType<typeof setInterval>;
  let lastEffectRuns = 0;
  let effectRunsPerSec = 0;
  const runHistory: number[] = [];

  const render = () => {
    const delta = _totalEffectRuns - lastEffectRuns;
    lastEffectRuns = _totalEffectRuns;
    runHistory.push(delta);
    if (runHistory.length > 10) runHistory.shift();
    effectRunsPerSec = runHistory.reduce((a, b) => a + b, 0);
    renderTab();
  };

  const setTab = (id: string) => {
    activeTab = id;
    for (const [tid, tel] of Object.entries(tabEls)) {
      tel.className = `dr-dt-tab${tid === id ? ' active' : ''}`;
    }
    renderTab();
  };

  const renderTab = () => {
    body.innerHTML = '';
    if (activeTab === 'overview') renderOverview();
    else if (activeTab === 'signals') renderSignals();
    else if (activeTab === 'emotion') renderEmotion();
    else if (activeTab === 'data')    renderData();
  };

  // ── Overview tab ──────────────────────────────────────────────────
  const renderOverview = () => {
    const sigs     = _getDevSignals();
    const sigCount = sigs.filter(s => s.type === 'signal').length;
    const cmpCount = sigs.filter(s => s.type === 'computed').length;

    const grid = el('div', 'dr-dt-stat-grid');
    grid.append(
      stat(String(sigCount),    'signals',    '#38bdf8'),
      stat(String(cmpCount),    'computed',   '#c084fc'),
      stat(String(_totalEffectRuns), 'effect runs', '#4ade80'),
    );
    body.appendChild(grid);

    const grid2 = el('div', 'dr-dt-stat-grid');
    grid2.append(
      stat(String(effectRunsPerSec), 'runs/sec',  '#fbbf24'),
      stat(String(opts.cache?.size ?? '—'), 'cached',    '#fb923c'),
      stat(opts.router ? opts.router.location.peek().path : '—', 'route', '#94a3b8'),
    );
    body.appendChild(grid2);

    if (opts.emotion) {
      const snap = opts.emotion.snapshot.peek();
      const section = el('div', 'dr-dt-section');
      const title = el('div', 'dr-dt-section-title');
      title.textContent = 'Emotion';
      section.appendChild(title);
      section.appendChild(emotionCard(snap.state, snap.confidence));
      body.appendChild(section);
    }
  };

  // ── Signals tab ───────────────────────────────────────────────────
  const renderSignals = () => {
    const search = document.createElement('input');
    search.className = 'dr-dt-search';
    search.placeholder = 'Filter signals…';
    search.value = signalFilter;
    search.addEventListener('input', () => { signalFilter = search.value; renderSignals(); });
    body.appendChild(search);

    const sigs = _getDevSignals().filter(s =>
      !signalFilter || s.label.toLowerCase().includes(signalFilter.toLowerCase())
    );

    if (sigs.length === 0) {
      const empty = el('div', '');
      empty.style.cssText = 'color:var(--dt-muted);text-align:center;padding:20px';
      empty.textContent = sigs.length === 0 && !signalFilter
        ? 'No signals registered. Call _enableDevMode() before creating signals.'
        : 'No matches.';
      body.appendChild(empty);
      return;
    }

    const hdr = el('div', 'dr-dt-row');
    hdr.style.cssText = 'color:var(--dt-muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em;padding-bottom:2px';
    hdr.innerHTML = '<span style="min-width:120px">Label</span><span style="flex:1">Value</span><span style="width:40px;text-align:right">Upd.</span>';
    body.appendChild(hdr);

    for (const sig of sigs) {
      const row = el('div', 'dr-dt-row');
      const labelEl = el('div', 'dr-dt-row-label');
      labelEl.textContent = sig.label;
      const badge = el('span', `dr-dt-row-badge dr-dt-badge-${sig.type}`);
      badge.textContent = sig.type === 'computed' ? 'C' : 'S';
      labelEl.prepend(badge, ' ');

      const valEl = el('div', 'dr-dt-row-value');
      try {
        const raw = sig.peek();
        valEl.textContent = JSON.stringify(raw, null, 0).slice(0, 60);
      } catch {
        valEl.textContent = '[unserializable]';
      }
      valEl.title = valEl.textContent ?? '';

      const updEl = el('div', '');
      updEl.style.cssText = 'color:var(--dt-muted);text-align:right;width:40px;flex-shrink:0';
      updEl.textContent = String(sig.updates.n);

      row.append(labelEl, valEl, updEl);
      body.appendChild(row);
    }
  };

  // ── Emotion tab ───────────────────────────────────────────────────
  const renderEmotion = () => {
    if (!opts.emotion) {
      const empty = el('div', '');
      empty.style.cssText = 'color:var(--dt-muted);text-align:center;padding:20px';
      empty.textContent = 'Pass emotion: EmotionProcessor to installDevtools()';
      body.appendChild(empty);
      return;
    }

    const snap = opts.emotion.snapshot.peek();

    body.appendChild(emotionCard(snap.state, snap.confidence));

    const statsSection = el('div', 'dr-dt-section');
    const statsTitle = el('div', 'dr-dt-section-title');
    statsTitle.textContent = 'Activity';
    statsSection.appendChild(statsTitle);

    const metrics: Array<[string, string]> = [
      ['Velocity',        snap.velocity.toFixed(3)],
      ['Click rate',      `${snap.clickRate.toFixed(1)}/min`],
      ['Keystroke rate',  `${snap.keystrokeRate.toFixed(1)}/min`],
      ['Backspace ratio', `${(snap.backspaceRatio * 100).toFixed(0)}%`],
      ['Idle',            `${(snap.idleMs / 1000).toFixed(1)}s`],
    ];
    for (const [lbl, val] of metrics) {
      statsSection.appendChild(infoRow(lbl, val));
    }
    body.appendChild(statsSection);

    if (snap.history.length > 0) {
      const histSection = el('div', 'dr-dt-section');
      const histTitle = el('div', 'dr-dt-section-title');
      histTitle.textContent = 'Transition history (latest first)';
      histSection.appendChild(histTitle);
      for (const state of [...snap.history].reverse().slice(0, 8)) {
        histSection.appendChild(infoRow('→', state));
      }
      body.appendChild(histSection);
    }
  };

  // ── Data tab ──────────────────────────────────────────────────────
  const renderData = () => {
    if (!opts.cache) {
      const empty = el('div', '');
      empty.style.cssText = 'color:var(--dt-muted);text-align:center;padding:20px';
      empty.textContent = 'Pass cache: Cache to installDevtools()';
      body.appendChild(empty);
      return;
    }

    const hdr = el('div', 'dr-dt-resource-row');
    hdr.style.cssText = 'color:var(--dt-muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em';
    hdr.innerHTML = '<span>Key</span><span>Status</span><span style="text-align:right">Refetch</span>';
    body.appendChild(hdr);

    // Cache exposes size but not entries iteration; show what we can
    const sizeRow = el('div', 'dr-dt-section');
    const sizeTitle = el('div', 'dr-dt-section-title');
    sizeTitle.textContent = 'Cache';
    sizeRow.appendChild(sizeTitle);
    sizeRow.appendChild(infoRow('Entries', String(opts.cache.size)));
    const refetchAllBtn = document.createElement('button');
    refetchAllBtn.className = 'dr-dt-btn';
    refetchAllBtn.style.cssText = 'width:100%;margin-top:6px;border:1px solid var(--dt-border);border-radius:5px;padding:5px;';
    refetchAllBtn.textContent = 'Invalidate All';
    refetchAllBtn.addEventListener('click', () => opts.cache?.invalidateAll());
    sizeRow.appendChild(refetchAllBtn);
    body.appendChild(sizeRow);
  };

  // ── Helpers ───────────────────────────────────────────────────────
  function el(tag: string, cls: string): HTMLElement {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function btn(text: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'dr-dt-btn';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function stat(value: string, label: string, color: string): HTMLElement {
    const s = el('div', 'dr-dt-stat');
    const v = el('div', 'dr-dt-stat-val');
    v.textContent = value;
    v.style.color = color;
    const l = el('div', 'dr-dt-stat-lbl');
    l.textContent = label;
    s.append(v, l);
    return s;
  }

  function infoRow(label: string, value: string): HTMLElement {
    const row = el('div', 'dr-dt-row');
    const l = el('div', 'dr-dt-row-label');
    l.textContent = label;
    const v = el('div', 'dr-dt-row-value');
    v.textContent = value;
    row.append(l, v);
    return row;
  }

  function emotionCard(state: string, confidence: number): HTMLElement {
    const card = el('div', 'dr-dt-emotion-state');
    const dot = el('div', 'dr-dt-emotion-dot');
    dot.style.background = EMOTION_COLOR[state] ?? '#64748b';
    const info = el('div', '');
    info.style.flex = '1';
    const name = el('div', 'dr-dt-emotion-name');
    name.textContent = state;
    name.style.color = EMOTION_COLOR[state] ?? '#e2e8f0';
    const confBar = el('div', 'dr-dt-conf-bar');
    const confFill = el('div', 'dr-dt-conf-fill');
    confFill.style.width = `${(confidence * 100).toFixed(0)}%`;
    confFill.style.background = EMOTION_COLOR[state] ?? '#38bdf8';
    confBar.appendChild(confFill);
    const confLabel = el('div', '');
    confLabel.style.cssText = 'color:var(--dt-muted);font-size:9px;margin-top:2px';
    confLabel.textContent = `Confidence: ${(confidence * 100).toFixed(0)}%`;
    info.append(name, confBar, confLabel);
    card.append(dot, info);
    return card;
  }

  // ── Show / hide ────────────────────────────────────────────────────
  const show = () => {
    visible = true;
    root.style.display = '';
    ticker = setInterval(render, 200);
    render();
  };

  const hide = () => {
    visible = false;
    root.style.display = 'none';
    clearInterval(ticker);
  };

  // Initial render
  ticker = setInterval(render, 200);
  render();

  return {
    show,
    hide,
    toggle: () => (visible ? hide() : show()),
    destroy: () => {
      clearInterval(ticker);
      root.remove();
    },
  };
}
