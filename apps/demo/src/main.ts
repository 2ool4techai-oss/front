import { loadGenome, signal, effect, h } from '@drishti/runtime';
import type { GenomeConfig, EmotionState } from '@drishti/runtime';

// ─── Brand DNA loaded once ────────────────────────────────────────────────
loadGenome({
  primaryColor:    '#2D6BE4',
  secondaryColor:  '#1A1A2E',
  accentColor:     '#E94560',
  fontFamily:      "'Inter', system-ui, -apple-system, sans-serif",
  fontSizeBase:    '16px',
  spacingUnit:     '8px',
  borderRadius:    '8px',
  shadowElevation: '0 2px 8px rgba(0,0,0,.10)',
  transitionSpeed: '220ms',
  transitionEasing:'cubic-bezier(0.4, 0, 0.2, 1)',
} satisfies GenomeConfig);

// ─── Global state ─────────────────────────────────────────────────────────
const activeTab = signal<string>('signals');

// ─── Tab definitions ──────────────────────────────────────────────────────
const TABS = [
  { id: 'signals',   label: '① Signals',   },
  { id: 'emotion',   label: '② Emotion',   },
  { id: 'healing',   label: '③ Healing',   },
  { id: 'security',  label: '④ Security',  },
  { id: 'compiler',  label: '⑤ .dr Syntax',},
];

// ─── App shell ────────────────────────────────────────────────────────────
function buildApp(): void {
  const app = document.getElementById('app')!;

  const shell = h('div', { style: 'max-width:900px;margin:0 auto;padding:32px 24px;font-family:var(--dr-font-family);' });

  // Header
  const header = h('div', { style: 'margin-bottom:32px;' });
  header.innerHTML = `
    <h1 style="font-size:2rem;font-weight:900;color:#1A1A2E;letter-spacing:-0.03em;margin:0 0 6px;">
      <span style="color:#2D6BE4">DRISHTI</span>
      <span style="font-weight:300;font-size:1.1rem;color:#64748b;margin-left:8px;">v0.1 — AI-Native Frontend Runtime</span>
    </h1>
    <p style="color:#64748b;margin:0;font-size:.9375rem;">
      A new frontend technology. Write <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px;">.dr</code> files.
      The compiler + runtime handles everything else.
    </p>
  `;
  shell.appendChild(header);

  // Tab bar
  const tabBar = h('div', { style: 'display:flex;gap:4px;border-bottom:2px solid #e2e8f0;margin-bottom:28px;flex-wrap:wrap;' });
  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.style.cssText = 'padding:8px 16px;border:none;background:none;cursor:pointer;font-size:.875rem;font-family:inherit;border-bottom:2px solid transparent;margin-bottom:-2px;color:#64748b;transition:all 200ms;white-space:nowrap;';
    btn.addEventListener('click', () => activeTab.set(tab.id));
    effect(() => {
      const active = activeTab() === tab.id;
      btn.style.borderBottomColor = active ? '#2D6BE4' : 'transparent';
      btn.style.color             = active ? '#2D6BE4' : '#64748b';
      btn.style.fontWeight        = active ? '600' : '400';
    });
    tabBar.appendChild(btn);
  }
  shell.appendChild(tabBar);

  // Content pane — only one tab rendered at a time
  const pane = h('div');
  effect(() => {
    pane.innerHTML = '';
    switch (activeTab()) {
      case 'signals':  pane.appendChild(tabSignals());  break;
      case 'emotion':  pane.appendChild(tabEmotion());  break;
      case 'healing':  pane.appendChild(tabHealing());  break;
      case 'security': pane.appendChild(tabSecurity()); break;
      case 'compiler': pane.appendChild(tabCompiler()); break;
    }
  });
  shell.appendChild(pane);

  app.appendChild(shell);
}

// ─── Tab: Signals ─────────────────────────────────────────────────────────
function tabSignals(): HTMLElement {
  const wrap = h('div');
  wrap.appendChild(sectionHead(
    'Fine-Grained Signals — No VDOM',
    'Only the exact DOM node that depends on a signal updates. Nothing else re-renders.',
  ));

  // Counter demo
  const count    = signal(0);
  const doubled  = signal(0); // manual for demo clarity
  const history  = signal<number[]>([]);

  effect(() => { doubled.set(count() * 2); });

  const box = card();

  const row = h('div', { style: 'display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px;' });

  const countEl = h('div', { style: 'font-size:3rem;font-weight:900;color:#2D6BE4;min-width:80px;text-align:center;font-variant-numeric:tabular-nums;' });
  const doubEl  = h('div', { style: 'font-size:1.25rem;color:#64748b;' });
  const histEl  = h('div', { style: 'font-size:.8rem;color:#94a3b8;margin-top:8px;font-family:monospace;' });

  effect(() => { countEl.textContent = String(count()); });
  effect(() => { doubEl.textContent  = `× 2 = ${doubled()}`; });
  effect(() => { histEl.textContent  = `history: [${history().slice(-8).join(', ')}]`; });

  const btnStyle = 'padding:8px 20px;border:none;border-radius:6px;font-size:1rem;cursor:pointer;font-family:inherit;font-weight:600;transition:opacity 150ms;';

  const inc = h('button', { style: btnStyle + 'background:#2D6BE4;color:#fff;' });
  inc.textContent = '+ Increment';
  inc.addEventListener('click', () => {
    const n = count.peek() + 1;
    count.set(n);
    history.set([...history.peek(), n]);
  });

  const dec = h('button', { style: btnStyle + 'background:#f1f5f9;color:#374151;' });
  dec.textContent = '− Decrement';
  dec.addEventListener('click', () => {
    const n = count.peek() - 1;
    count.set(n);
    history.set([...history.peek(), n]);
  });

  const rst = h('button', { style: btnStyle + 'background:#fee2e2;color:#991b1b;' });
  rst.textContent = 'Reset';
  rst.addEventListener('click', () => { count.set(0); history.set([]); });

  row.appendChild(countEl);
  row.appendChild(doubEl);

  const btns = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' });
  btns.appendChild(inc); btns.appendChild(dec); btns.appendChild(rst);

  box.appendChild(codeSnip(`// DRISHTI — signal-based reactivity
const count   = signal(0);
const doubled = computed(() => count() * 2);

// Only this text node updates — nothing else re-renders
effect(() => { el.textContent = \`\${count()} × 2 = \${doubled()}\`; });`));
  box.appendChild(row);
  box.appendChild(btns);
  box.appendChild(histEl);

  wrap.appendChild(box);
  return wrap;
}

// ─── Tab: Emotion ─────────────────────────────────────────────────────────
function tabEmotion(): HTMLElement {
  const wrap = h('div');
  wrap.appendChild(sectionHead(
    'Emotion Intelligence',
    'DRISHTI reads mouse velocity, click rhythm, and scroll hesitation — then adapts the UI.',
  ));

  const emotion = signal<EmotionState>('calm');

  const STATES: { state: EmotionState; emoji: string; color: string; bg: string; desc: string }[] = [
    { state: 'calm',        emoji: '😌', color: '#065f46', bg: '#ecfdf5', desc: 'Normal browsing — default UI' },
    { state: 'engaged',     emoji: '🎯', color: '#1e40af', bg: '#eff6ff', desc: 'Actively interacting — speed up' },
    { state: 'frustrated',  emoji: '😤', color: '#92400e', bg: '#fffbeb', desc: 'Rapid clicks — larger text, slower animations' },
    { state: 'confused',    emoji: '🤔', color: '#5b21b6', bg: '#f5f3ff', desc: 'Long pauses — show tooltips, simplify layout' },
    { state: 'celebrating', emoji: '🎉', color: '#be185d', bg: '#fdf2f8', desc: 'Success event — burst animation' },
  ];

  const box = card();

  // Live badge
  const badge = h('div', { style: 'display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:9999px;font-weight:700;font-size:1rem;margin-bottom:20px;transition:all 300ms;' });
  effect(() => {
    const s = STATES.find(x => x.state === emotion())!;
    badge.textContent = `${s.emoji}  ${s.state.charAt(0).toUpperCase() + s.state.slice(1)}`;
    badge.style.color      = s.color;
    badge.style.background = s.bg;
  });

  // Adaptive UI preview
  const preview = h('div', { style: 'padding:16px;border:1.5px solid #e2e8f0;border-radius:8px;margin-bottom:20px;transition:all 300ms;' });
  const previewText = h('p', { style: 'margin:0;transition:all 300ms;' });
  effect(() => {
    const s = emotion();
    previewText.style.fontSize   = s === 'frustrated' ? '1.2rem' : '1rem';
    previewText.style.fontWeight = s === 'frustrated' ? '600' : '400';
    previewText.style.color      = s === 'confused' ? '#5b21b6' : '#374151';
    preview.style.background     = s === 'celebrating' ? '#fdf2f8' : '#fff';
    preview.style.borderColor    = s === 'engaged' ? '#2D6BE4' : '#e2e8f0';
    previewText.textContent      = STATES.find(x => x.state === s)!.desc;
  });
  preview.appendChild(previewText);

  // Simulate buttons
  const btns = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' });
  for (const s of STATES) {
    const btn = document.createElement('button');
    btn.style.cssText = `padding:6px 14px;border:1.5px solid ${s.color}33;border-radius:6px;cursor:pointer;background:${s.bg};color:${s.color};font-size:.8rem;font-family:inherit;font-weight:600;`;
    btn.textContent = `${s.emoji} ${s.state}`;
    btn.addEventListener('click', () => emotion.set(s.state));
    btns.appendChild(btn);
  }

  box.appendChild(codeSnip(`// DRISHTI — emotion adapts UI automatically
const processor = new EmotionProcessor(container);

effect(() => {
  if (processor.state() === 'frustrated') {
    el.style.fontSize = '1.2rem'; // larger text
  }
  if (processor.state() === 'confused') {
    tooltip.style.opacity = '1';  // show help
  }
});`));
  box.appendChild(badge);
  box.appendChild(preview);
  box.appendChild(btns);

  wrap.appendChild(box);
  return wrap;
}

// ─── Tab: Healing ─────────────────────────────────────────────────────────
function tabHealing(): HTMLElement {
  const wrap = h('div');
  wrap.appendChild(sectionHead(
    'Self-Healing Components',
    'Components detect failures and recover automatically — no try/catch in your app code.',
  ));

  const box = card();

  const status   = signal<'idle' | 'loading' | 'healing' | 'ready' | 'failed'>('idle');
  const attempt  = signal(0);
  const log      = signal<string[]>([]);

  const addLog = (msg: string) => log.set([...log.peek(), `${new Date().toLocaleTimeString()} — ${msg}`]);

  let failCount = 0;

  const runHeal = async () => {
    status.set('loading');
    attempt.set(0);
    log.set([]);
    addLog('Starting data fetch…');
    failCount = 0;

    const maxRetries = 3;
    for (let i = 1; i <= maxRetries; i++) {
      attempt.set(i);
      await sleep(600);
      failCount++;

      if (failCount < 3) {
        status.set('healing');
        addLog(`Attempt ${i} failed — retrying in ${600 * i}ms…`);
        await sleep(600 * i);
      } else {
        status.set('ready');
        addLog('✓ Recovered! Data loaded successfully.');
        return;
      }
    }
    status.set('failed');
    addLog('✗ All retries exhausted — showing fallback UI');
  };

  const statusColors: Record<string, string> = {
    idle: '#6b7280', loading: '#2563eb', healing: '#d97706', ready: '#16a34a', failed: '#dc2626',
  };

  const statusBadge = h('div', { style: 'display:inline-block;padding:4px 12px;border-radius:9999px;font-size:.8rem;font-weight:700;margin-bottom:12px;transition:all 300ms;background:#f1f5f9;' });
  const attemptEl   = h('div', { style: 'font-size:.875rem;color:#64748b;margin-bottom:12px;' });
  const logEl       = h('div', { style: 'background:#0f172a;border-radius:6px;padding:12px;font-family:monospace;font-size:.75rem;color:#94a3b8;min-height:80px;max-height:140px;overflow-y:auto;' });

  effect(() => {
    const s = status();
    statusBadge.textContent      = s.toUpperCase();
    statusBadge.style.color      = statusColors[s] ?? '#6b7280';
    statusBadge.style.background = (statusColors[s] ?? '#6b7280') + '18';
  });
  effect(() => { attemptEl.textContent = attempt() > 0 ? `Attempt ${attempt()} of 3` : ''; });
  effect(() => {
    logEl.innerHTML = log().map(l => `<div>${l}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  });

  const btn = h('button', {
    style: 'padding:8px 20px;background:#2D6BE4;color:#fff;border:none;border-radius:6px;font-size:.875rem;font-family:inherit;font-weight:600;cursor:pointer;margin-bottom:16px;',
  });
  btn.textContent = '▶ Simulate Failure & Auto-Heal';
  btn.addEventListener('click', () => { void runHeal(); });

  box.appendChild(codeSnip(`// DRISHTI — healing declared, not coded
unit: DataCard
  data: connect(api.orders)
  heal: retry(3) then empty-state

// No try/catch. No error state. No loading state.
// DRISHTI runtime handles it.`));
  box.appendChild(statusBadge);
  box.appendChild(attemptEl);
  box.appendChild(btn);
  box.appendChild(logEl);

  wrap.appendChild(box);
  return wrap;
}

// ─── Tab: Security ────────────────────────────────────────────────────────
function tabSecurity(): HTMLElement {
  const wrap = h('div');
  wrap.appendChild(sectionHead(
    'Zero-Trust Security — Built In',
    'Every input is sanitized at the boundary. XSS attempts are blocked before they reach the DOM.',
  ));

  const box = card();
  const input = signal('');
  const sanitized = signal('');

  const TESTS = [
    { label: 'Normal text',  value: 'Hello Naveen, welcome back!' },
    { label: 'XSS attempt',  value: '<img src=x onerror="alert(\'hacked\')">' },
    { label: 'Script inject',value: '<script>document.cookie</script>' },
    { label: 'SQL inject',   value: "'; DROP TABLE users; --" },
    { label: 'Link inject',  value: '<a href="javascript:void(0)">Click</a>' },
  ];

  effect(() => {
    const raw = input();
    const div = document.createElement('div');
    div.textContent = raw;
    sanitized.set(div.innerHTML);
  });

  const inputEl = document.createElement('textarea');
  inputEl.placeholder = 'Type anything or use test buttons below…';
  inputEl.style.cssText = 'width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:monospace;font-size:.8rem;resize:vertical;min-height:60px;box-sizing:border-box;outline:none;';
  inputEl.addEventListener('input', () => input.set(inputEl.value));

  const outputEl = h('div', { style: 'margin-top:12px;padding:10px;background:#f8fafc;border-radius:6px;font-family:monospace;font-size:.8rem;color:#374151;word-break:break-all;min-height:40px;border:1.5px solid #e2e8f0;' });
  const label    = h('p', { style: 'font-size:.75rem;color:#64748b;margin:8px 0 4px;font-weight:500;' });
  label.textContent = 'Sanitized output (safe to render):';

  effect(() => {
    const safe = sanitized();
    const raw  = input();
    const blocked = raw !== safe && raw.length > 0;
    outputEl.textContent      = safe || '—';
    outputEl.style.color      = blocked ? '#16a34a' : '#374151';
    outputEl.style.borderColor = blocked ? '#86efac' : '#e2e8f0';
    outputEl.style.background = blocked ? '#f0fdf4' : '#f8fafc';
    if (blocked) {
      label.textContent = '✓ Attack neutralised — safe to render:';
      label.style.color = '#16a34a';
    } else {
      label.textContent = 'Sanitized output (safe to render):';
      label.style.color = '#64748b';
    }
  });

  const testBtns = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;' });
  for (const t of TESTS) {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    btn.style.cssText = 'padding:4px 10px;border:1px solid #e2e8f0;border-radius:4px;font-size:.75rem;cursor:pointer;background:#fff;font-family:inherit;';
    btn.addEventListener('click', () => { inputEl.value = t.value; input.set(t.value); });
    testBtns.appendChild(btn);
  }

  box.appendChild(codeSnip(`// DRISHTI — security enforced at compile time
unit: CommentBox
  data: connect(api.comments)
  trust: sanitized          // compiler injects sanitize()

// Any innerHTML without trust: sanitized
// → compile error, not runtime bug`));
  box.appendChild(inputEl);
  box.appendChild(testBtns);
  box.appendChild(label);
  box.appendChild(outputEl);

  wrap.appendChild(box);
  return wrap;
}

// ─── Tab: Compiler ────────────────────────────────────────────────────────
function tabCompiler(): HTMLElement {
  const wrap = h('div');
  wrap.appendChild(sectionHead(
    '.dr Language — Live Compiler',
    'This is the new language. Write intent. The compiler writes the code.',
  ));

  const DEFAULT = `surface: OrdersDashboard
  intent: show customer orders
  secure: role(manager)

  unit: RevenueCard
    data: connect(api.revenue, realtime)
    feel: celebrate if trending.positive
    feel: calm-alert if trending.negative
    heal: retry(3) then empty-state
    secure: role(manager, finance)

  unit: OrderTable
    data: connect(api.orders)
    columns: [customer, amount, status]
    heal: auto
    layout: grid(2)`;

  const container = h('div', {
    style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;',
  });

  // Input panel
  const inputPanel = h('div', { style: 'border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);' });
  const inputHead  = h('div', { style: 'background:#1e1e2e;padding:10px 16px;display:flex;align-items:center;gap:6px;' });
  ['#ff5f57','#febc2e','#28c840'].forEach(c => {
    const dot = document.createElement('span');
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${c};display:inline-block;`;
    inputHead.appendChild(dot);
  });
  const inputTitle = document.createElement('span');
  inputTitle.textContent = 'orders.dr';
  inputTitle.style.cssText = 'color:#a6b3cc;font-size:.75rem;margin-left:6px;font-family:monospace;';
  inputHead.appendChild(inputTitle);

  const textarea = document.createElement('textarea');
  textarea.value = DEFAULT;
  textarea.style.cssText = 'width:100%;min-height:340px;padding:16px;background:#1e1e2e;color:#cdd6f4;border:none;outline:none;font-family:monospace;font-size:.8rem;line-height:1.7;resize:vertical;tab-size:2;box-sizing:border-box;';
  inputPanel.appendChild(inputHead);
  inputPanel.appendChild(textarea);

  // Output panel
  const outputPanel = h('div', { style: 'border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);' });
  const outputHead  = h('div', { style: 'background:#0d1117;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;' });
  const outputTitle = document.createElement('span');
  outputTitle.textContent = 'Generated TypeScript';
  outputTitle.style.cssText = 'color:#8b949e;font-size:.75rem;font-family:monospace;';
  const timing = document.createElement('span');
  timing.style.cssText = 'color:#3fb950;font-size:.7rem;font-family:monospace;';
  outputHead.appendChild(outputTitle);
  outputHead.appendChild(timing);

  const output = document.createElement('pre');
  output.style.cssText = 'margin:0;min-height:340px;padding:16px;background:#0d1117;color:#e6edf3;font-family:monospace;font-size:.8rem;line-height:1.7;overflow:auto;';

  const errEl = h('div', { style: 'display:none;background:#2d1b1e;border-top:1px solid #f85149;padding:10px 14px;color:#f85149;font-size:.75rem;font-family:monospace;white-space:pre-wrap;' });

  outputPanel.appendChild(outputHead);
  outputPanel.appendChild(output);
  outputPanel.appendChild(errEl);

  container.appendChild(inputPanel);
  container.appendChild(outputPanel);

  // Lazy-load compiler only once, on first use
  let compilerLoaded = false;
  let compileFn: ((src: string) => { code: string; errors: string[] }) | null = null;

  const compile = (src: string) => {
    if (compileFn) {
      const t0 = performance.now();
      const r  = compileFn(src);
      timing.textContent = `✓ ${(performance.now() - t0).toFixed(1)}ms`;
      if (r.errors.length) {
        errEl.style.display = 'block';
        errEl.textContent   = r.errors.join('\n');
        output.textContent  = '';
      } else {
        errEl.style.display = 'none';
        output.textContent  = r.code;
      }
    }
  };

  if (!compilerLoaded) {
    compilerLoaded = true;
    timing.textContent = 'loading compiler…';
    import('@drishti/compiler').then(m => {
      compileFn = m.compile;
      compile(textarea.value);
    });
  }

  let debounce: ReturnType<typeof setTimeout>;
  textarea.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => compile(textarea.value), 400);
  });

  wrap.appendChild(container);
  return wrap;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function sectionHead(title: string, desc: string): HTMLElement {
  const el = h('div', { style: 'margin-bottom:20px;' });
  el.innerHTML = `
    <h2 style="font-size:1.2rem;font-weight:700;color:#0f172a;margin:0 0 4px;">${title}</h2>
    <p style="color:#64748b;font-size:.875rem;margin:0;">${desc}</p>
  `;
  return el;
}

function card(): HTMLElement {
  return h('div', {
    style: 'background:#fff;border-radius:10px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.08);border:1px solid #f1f5f9;',
  });
}

function codeSnip(code: string): HTMLElement {
  const pre = document.createElement('pre');
  pre.textContent = code;
  pre.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;font-size:.75rem;line-height:1.6;color:#374151;margin:0 0 16px;overflow-x:auto;font-family:monospace;';
  return pre;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

buildApp();
