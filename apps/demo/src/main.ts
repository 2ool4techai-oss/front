import { loadGenome, signal, effect } from '@nexoraaidrishti/runtime';
import type { GenomeConfig, EmotionState } from '@nexoraaidrishti/runtime';

loadGenome({
  primaryColor: '#3b82f6', secondaryColor: '#07070f', accentColor: '#8b5cf6',
  fontFamily: "'Inter', system-ui, sans-serif", fontSizeBase: '16px',
  spacingUnit: '8px', borderRadius: '10px',
  shadowElevation: '0 4px 24px rgba(0,0,0,.4)',
  transitionSpeed: '600ms', transitionEasing: 'cubic-bezier(0.34,1.56,0.64,1)',
} satisfies GenomeConfig);

// ── Emotion atmosphere map ────────────────────────────────────────────────
type EmotionCfg = { hue: number; sat: string; anim: string; blur: string; brightness: string; label: string; emoji: string; desc: string; };
const EMOTION_CFG: Record<EmotionState, EmotionCfg> = {
  calm:        { hue: 230,  sat: '70%', anim: '700ms', blur: '20px', brightness: '1',    label: 'Calm',        emoji: '😌', desc: 'Relaxed browsing — default atmosphere'             },
  engaged:     { hue: 210,  sat: '90%', anim: '350ms', blur: '16px', brightness: '1.15', label: 'Engaged',     emoji: '🎯', desc: 'Active interaction — brighter, faster, sharper'    },
  frustrated:  { hue: 30,   sat: '80%', anim: '900ms', blur: '24px', brightness: '0.9',  label: 'Frustrated',  emoji: '😤', desc: 'Warm tones — slower animations to calm the user'  },
  confused:    { hue: 270,  sat: '65%', anim: '800ms', blur: '28px', brightness: '0.85', label: 'Confused',    emoji: '🤔', desc: 'Purple haze — increased blur, tooltips surface'    },
  celebrating: { hue: 340,  sat: '90%', anim: '300ms', blur: '18px', brightness: '1.3',  label: 'Celebrating', emoji: '🎉', desc: 'Full spectrum burst — particles fly, UI dances'    },
};

const activeTab    = signal<string>('signals');
const emotionState = signal<EmotionState>('calm');

// ── Apply emotion to CSS vars ─────────────────────────────────────────────
effect(() => {
  const cfg = EMOTION_CFG[emotionState()];
  const r = document.documentElement;
  r.style.setProperty('--emotion-hue',        String(cfg.hue));
  r.style.setProperty('--emotion-sat',        cfg.sat);
  r.style.setProperty('--emotion-anim',       cfg.anim);
  r.style.setProperty('--emotion-blur',       cfg.blur);
  r.style.setProperty('--emotion-brightness', cfg.brightness);

  if (emotionState() === 'celebrating') triggerParticles();
});

// ── Particle system ───────────────────────────────────────────────────────
function triggerParticles(): void {
  const canvas = document.getElementById('particles') as HTMLCanvasElement;
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const particles: { x: number; y: number; vx: number; vy: number; life: number; hue: number; size: number }[] = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.6,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 3,
      life: 1,
      hue: Math.random() * 360,
      size: Math.random() * 5 + 2,
    });
  }

  let frame = 0;
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.016;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = `hsl(${p.hue},90%,65%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (alive > 0 && frame++ < 180) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(animate);
}

// ── Shell ─────────────────────────────────────────────────────────────────
function buildApp(): void {
  const app = document.getElementById('app')!;

  const shell = el('div', `
    max-width: 960px;
    margin: 0 auto;
    padding: 0 24px 80px;
  `);

  shell.appendChild(buildHeader());
  shell.appendChild(buildTabBar());

  const pane = el('div', '');
  effect(() => {
    pane.innerHTML = '';
    const section = el('div', '');
    section.className = 'tab-enter';
    switch (activeTab()) {
      case 'signals':  section.appendChild(tabSignals());  break;
      case 'emotion':  section.appendChild(tabEmotion());  break;
      case 'healing':  section.appendChild(tabHealing());  break;
      case 'security': section.appendChild(tabSecurity()); break;
      case 'compiler': section.appendChild(tabCompiler()); break;
    }
    pane.appendChild(section);
  });
  shell.appendChild(pane);
  app.appendChild(shell);
}

// ── Header ────────────────────────────────────────────────────────────────
function buildHeader(): HTMLElement {
  const header = el('header', `
    padding: 48px 0 36px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
  `);

  const left = el('div', '');
  const wordmark = el('h1', `
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
    margin-bottom: 10px;
  `);
  wordmark.innerHTML = `
    <span class="glow" style="
      background: linear-gradient(135deg, #60a5fa, #a78bfa, #60a5fa);
      background-size: 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer-text 4s linear infinite;
    ">DRISHTI</span>
    <style>
      @keyframes shimmer-text {
        0%   { background-position: 0% }
        100% { background-position: 200% }
      }
    </style>
  `;

  const tagline = el('p', 'color:#64748b;font-size:.9375rem;line-height:1.5;max-width:520px;');
  tagline.innerHTML = `A new frontend technology — <em style="color:#94a3b8;font-style:normal;">write intent in <code style="color:#a78bfa;font-family:var(--font-mono);font-size:.85em;">.dr</code>, the compiler writes the code.</em>
  <br>Sees your users. Feels their emotion. Heals itself. Protects by default.`;

  left.appendChild(wordmark);
  left.appendChild(tagline);

  // Live emotion widget
  const emotionWidget = buildEmotionWidget();
  header.appendChild(left);
  header.appendChild(emotionWidget);
  return header;
}

function buildEmotionWidget(): HTMLElement {
  const wrap = el('div', `
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    min-width: 180px;
  `);

  const badge = el('div', `
    padding: 8px 16px;
    border-radius: 9999px;
    font-size: .875rem;
    font-weight: 700;
    border: 1px solid;
    transition: all 600ms ease;
    cursor: default;
  `);

  const meter = el('div', 'width:180px;height:3px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;');
  const meterFill = el('div', 'height:100%;border-radius:2px;transition:all 600ms ease;width:0%;');
  meter.appendChild(meterFill);

  const label = el('div', 'font-size:.7rem;color:#475569;letter-spacing:0.05em;text-transform:uppercase;');
  label.textContent = 'Live emotion · move your mouse';

  effect(() => {
    const e = emotionState();
    const cfg = EMOTION_CFG[e];
    const hsl = `hsl(${cfg.hue},${cfg.sat},65%)`;
    const bg  = `hsl(${cfg.hue},${cfg.sat},65%,0.12)`;
    badge.textContent      = `${cfg.emoji}  ${cfg.label}`;
    badge.style.color      = hsl;
    badge.style.background = `hsl(${cfg.hue} ${cfg.sat} 65% / 0.1)`;
    badge.style.borderColor = `hsl(${cfg.hue} ${cfg.sat} 65% / 0.25)`;
    meterFill.style.background = `linear-gradient(90deg, hsl(${cfg.hue},${cfg.sat},55%), hsl(${cfg.hue+40},${cfg.sat},65%))`;
    meterFill.style.width  = e === 'calm' ? '20%' : e === 'engaged' ? '75%' : e === 'frustrated' ? '90%' : e === 'confused' ? '45%' : '100%';
  });

  wrap.appendChild(badge);
  wrap.appendChild(meter);
  wrap.appendChild(label);
  return wrap;
}

// ── Tab bar ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'signals',  label: 'Signals'   },
  { id: 'emotion',  label: 'Emotion'   },
  { id: 'healing',  label: 'Healing'   },
  { id: 'security', label: 'Security'  },
  { id: 'compiler', label: '.dr Syntax'},
];

function buildTabBar(): HTMLElement {
  const bar = el('div', `
    display: flex;
    gap: 2px;
    margin-bottom: 28px;
    background: rgba(255,255,255,.03);
    border: 1px solid var(--c-border);
    border-radius: var(--radius-lg);
    padding: 4px;
  `);

  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.style.cssText = `
      flex: 1; padding: 9px 12px;
      border: none; border-radius: var(--radius-md);
      font-family: var(--font-sans); font-size: .8125rem; font-weight: 500;
      cursor: pointer; transition: all 250ms ease;
      white-space: nowrap;
    `;
    btn.addEventListener('click', () => activeTab.set(tab.id));
    effect(() => {
      const active = activeTab() === tab.id;
      btn.style.background  = active ? 'rgba(59,130,246,0.2)'  : 'transparent';
      btn.style.color        = active ? '#93c5fd'               : '#64748b';
      btn.style.fontWeight   = active ? '600'                   : '500';
      btn.style.boxShadow    = active ? '0 0 12px rgba(59,130,246,.15)' : 'none';
    });
    bar.appendChild(btn);
  }
  return bar;
}

// ── Section helpers ───────────────────────────────────────────────────────
function sectionHead(title: string, sub: string): HTMLElement {
  const wrap = el('div', 'margin-bottom:24px;');
  const h2 = document.createElement('h2');
  h2.innerHTML = title;
  h2.style.cssText = 'font-size:1.375rem;font-weight:800;color:#f1f5f9;margin-bottom:4px;letter-spacing:-0.02em;';
  const p = document.createElement('p');
  p.innerHTML = sub;
  p.style.cssText = 'color:#64748b;font-size:.875rem;line-height:1.6;';
  wrap.appendChild(h2); wrap.appendChild(p);
  return wrap;
}

function glassCard(padding = '24px'): HTMLElement {
  const card = el('div', `padding:${padding};`);
  card.className = 'glass';
  return card;
}

function codeBlock(html: string): HTMLElement {
  const pre = el('pre', 'margin-bottom:20px;');
  pre.className = 'code-block';
  pre.innerHTML = html;
  return pre;
}

function drCode(raw: string): HTMLElement {
  const colored = raw
    .replace(/(surface|unit|intent|secure|data|feel|heal|adapt|predict|layout|on|columns|connect|realtime|role|retry|then|auto|if)(?=:|\s|$)/g, '<span class="kw">$1</span>')
    .replace(/(celebrate|calm-alert|guide|pulse)/g, '<span class="str">$1</span>')
    .replace(/(#[^\n]*)/g, '<span class="cmt">$1</span>');
  return codeBlock(colored);
}

function tsCode(raw: string): HTMLElement {
  const colored = raw
    .replace(/\b(const|let|import|export|from|function|return|type|interface|async|await|void)\b/g, '<span class="kw">$1</span>')
    .replace(/\b(signal|effect|computed|connect|createSurface|createUnit|loadGenome)\b/g, '<span class="fn">$1</span>')
    .replace(/'([^']*)'/g, '<span class="str">\'$1\'</span>')
    .replace(/"([^"]*)"/g, '<span class="str">"$1"</span>')
    .replace(/\/\/[^\n]*/g, '<span class="cmt">$&</span>')
    .replace(/\b(\d+)\b/g, '<span class="num">$1</span>');
  return codeBlock(colored);
}

// ── Mouse emotion tracker (lightweight) ──────────────────────────────────
let _lastMove = Date.now();
let _clicks: number[] = [];
let _velocity = 0;
let _prevX = 0, _prevY = 0, _prevT = 0;

document.addEventListener('pointermove', e => {
  _lastMove = Date.now();
  const t = performance.now();
  const dt = t - _prevT;
  if (dt > 0 && dt < 200) {
    const dx = e.clientX - _prevX, dy = e.clientY - _prevY;
    _velocity = 0.7 * _velocity + 0.3 * (Math.sqrt(dx*dx+dy*dy)/dt*1000);
  }
  _prevX = e.clientX; _prevY = e.clientY; _prevT = t;
}, { passive: true });

document.addEventListener('click', () => {
  _clicks.push(Date.now());
  _clicks = _clicks.filter(t => Date.now() - t < 3000);
}, { passive: true });

setInterval(() => {
  const idle = Date.now() - _lastMove;
  if (idle > 5000)              { emotionState.set('calm');       return; }
  if (_clicks.length >= 5)      { emotionState.set('frustrated'); return; }
  if (_velocity > 700)          { emotionState.set('frustrated'); return; }
  if (_velocity > 80)           { emotionState.set('engaged');    return; }
  emotionState.set('calm');
}, 600);

// ── Tab: Signals ──────────────────────────────────────────────────────────
function tabSignals(): HTMLElement {
  const wrap = el('div', 'display:flex;flex-direction:column;gap:20px;');
  wrap.appendChild(sectionHead(
    '① Fine-Grained Signals — <span style="color:#60a5fa">No VDOM</span>',
    'Only the exact DOM node bound to a signal updates. Zero diffing. Zero overhead. Pure precision.',
  ));

  const count   = signal(0);
  const history = signal<number[]>([]);

  const card = glassCard();

  const numDisplay = el('div', `
    font-size: 5rem; font-weight: 900; letter-spacing: -0.05em;
    text-align: center; padding: 20px 0;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    transition: transform 300ms cubic-bezier(0.34,1.56,0.64,1);
    font-variant-numeric: tabular-nums;
  `);
  numDisplay.textContent = '0';
  effect(() => {
    numDisplay.textContent = String(count());
    numDisplay.style.transform = 'scale(1.15)';
    setTimeout(() => { numDisplay.style.transform = 'scale(1)'; }, 300);
  });

  const meta = el('div', 'text-align:center;color:#475569;font-size:.8125rem;margin-bottom:24px;font-family:var(--font-mono);');
  effect(() => {
    const h = history();
    meta.textContent = h.length ? `history: [ ${h.slice(-6).join(', ')} ]` : 'click to start';
  });

  const btns = el('div', 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:24px;');

  const makeBtn = (label: string, cls: string, fn: () => void) => {
    const b = document.createElement('button');
    b.className = `btn ${cls}`; b.textContent = label;
    b.addEventListener('click', fn); return b;
  };

  btns.appendChild(makeBtn('＋ Increment', 'btn-primary', () => {
    const n = count.peek() + 1; count.set(n);
    history.set([...history.peek(), n]);
  }));
  btns.appendChild(makeBtn('－ Decrement', 'btn-ghost', () => {
    const n = count.peek() - 1; count.set(n);
    history.set([...history.peek(), n]);
  }));
  btns.appendChild(makeBtn('✕ Reset', 'btn-danger', () => {
    count.set(0); history.set([]);
  }));
  btns.appendChild(makeBtn('🎉 Celebrate', 'btn-ghost', () => {
    emotionState.set('celebrating');
    setTimeout(() => emotionState.set('calm'), 3000);
  }));

  card.appendChild(tsCode(
`// DRISHTI — fine-grained reactivity
const count   = signal(0);
const doubled = computed(() => count() * 2);

// Only THIS text node updates — nothing re-renders
effect(() => { el.textContent = String(count()); });

// No useState. No re-render. No VDOM diff.`));
  card.appendChild(numDisplay);
  card.appendChild(meta);
  card.appendChild(btns);

  // Signal graph visual
  const graphLabel = el('p', 'font-size:.75rem;color:#475569;margin-bottom:8px;font-family:var(--font-mono);letter-spacing:0.02em;');
  graphLabel.textContent = '── signal dependency graph';
  const graphWrap = el('div', `
    background: rgba(0,0,0,0.3); border-radius:8px; padding:14px 16px;
    font-family:var(--font-mono); font-size:.72rem; color:#475569;
    border:1px solid rgba(255,255,255,.05);
  `);
  effect(() => {
    const n = count();
    graphWrap.innerHTML = `
      <span style="color:#60a5fa">signal</span>(count)  <span style="color:#475569">←</span>  <span style="color:#f1f5f9">${n}</span>
      <br><span style="color:#94a3b8">  └─▶</span> <span style="color:#a78bfa">effect</span>(numDisplay.textContent)  <span style="color:#10b981">✓ updated</span>
      <br><span style="color:#94a3b8">  └─▶</span> <span style="color:#a78bfa">effect</span>(meta.textContent)        <span style="color:#10b981">✓ updated</span>
      <br><span style="color:#94a3b8">  └─▶</span> <span style="color:#475569">effect</span>(otherComponent)         <span style="color:#475569">⊘ not subscribed</span>
    `;
  });

  card.appendChild(graphLabel);
  card.appendChild(graphWrap);
  wrap.appendChild(card);
  return wrap;
}

// ── Tab: Emotion ──────────────────────────────────────────────────────────
function tabEmotion(): HTMLElement {
  const wrap = el('div', 'display:flex;flex-direction:column;gap:20px;');
  wrap.appendChild(sectionHead(
    '② Emotion Intelligence — <span style="color:#a78bfa">UI that Feels</span>',
    'DRISHTI reads mouse velocity, click rhythm, and scroll hesitation. The <em>entire</em> atmosphere responds. Try the buttons or move your mouse.',
  ));

  const card = glassCard();

  // Atmosphere preview
  const preview = el('div', `
    border-radius:10px; padding:20px; margin-bottom:20px;
    border:1px solid; transition:all 700ms ease;
    text-align:center;
  `);
  const previewTitle = el('div', 'font-size:2rem;margin-bottom:8px;transition:all 600ms ease;');
  const previewDesc  = el('div', 'font-size:.875rem;transition:all 600ms ease;');

  effect(() => {
    const e = emotionState();
    const cfg = EMOTION_CFG[e];
    const hsl  = `hsl(${cfg.hue},${cfg.sat},65%)`;
    const bg   = `hsl(${cfg.hue},${cfg.sat},65%,0.07)`;
    const bdr  = `hsl(${cfg.hue},${cfg.sat},65%,0.2)`;
    preview.style.background   = bg;
    preview.style.borderColor  = bdr;
    previewTitle.textContent   = `${cfg.emoji}  ${cfg.label}`;
    previewTitle.style.color   = hsl;
    previewDesc.textContent    = cfg.desc;
    previewDesc.style.color    = `hsl(${cfg.hue},${cfg.sat},80%)`;
    if (e === 'celebrating') preview.style.animation = 'celebrate-scale 600ms ease';
    else preview.style.animation = '';
  });

  preview.appendChild(previewTitle);
  preview.appendChild(previewDesc);

  // Simulate buttons
  const simLabel = el('p', 'font-size:.75rem;color:#475569;font-family:var(--font-mono);margin-bottom:10px;');
  simLabel.textContent = '── simulate emotion state';
  const simBtns = el('div', 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;');

  for (const [state, cfg] of Object.entries(EMOTION_CFG) as [EmotionState, EmotionCfg][]) {
    const btn = document.createElement('button');
    const hsl = `hsl(${cfg.hue},${cfg.sat},65%)`;
    btn.className = 'btn';
    btn.style.cssText = `
      background:hsl(${cfg.hue},${cfg.sat},65%,0.1);
      color:${hsl};border:1px solid hsl(${cfg.hue},${cfg.sat},65%,0.25);
      padding:7px 14px;font-size:.8rem;
    `;
    btn.textContent = `${cfg.emoji}  ${cfg.label}`;
    btn.addEventListener('click', () => {
      emotionState.set(state);
      if (state !== 'celebrating') setTimeout(() => emotionState.set('calm'), 4000);
    });
    simBtns.appendChild(btn);
  }

  // CSS vars display
  const varsLabel = el('p', 'font-size:.75rem;color:#475569;font-family:var(--font-mono);margin-bottom:8px;');
  varsLabel.textContent = '── css variables updated by emotion';
  const varsDisplay = el('div', '');
  varsDisplay.className = 'terminal';
  varsDisplay.style.cssText += 'max-height:130px;';
  effect(() => {
    const e = emotionState();
    const cfg = EMOTION_CFG[e];
    varsDisplay.innerHTML = `<span class="log-ok">--emotion-hue</span>        <span style="color:#e2e8f0">${cfg.hue}</span>
<span class="log-ok">--emotion-sat</span>        <span style="color:#e2e8f0">${cfg.sat}</span>
<span class="log-ok">--emotion-anim</span>       <span style="color:#e2e8f0">${cfg.anim}</span>  <span style="color:#475569"># animation speed</span>
<span class="log-ok">--emotion-blur</span>       <span style="color:#e2e8f0">${cfg.blur}</span>  <span style="color:#475569"># glass blur intensity</span>
<span class="log-ok">--emotion-brightness</span> <span style="color:#e2e8f0">${cfg.brightness}</span>   <span style="color:#475569"># aurora brightness</span>`;
  });

  card.appendChild(drCode(
`surface: Dashboard
  unit: MetricCard
    feel: celebrate if revenue.trending.positive
    feel: calm-alert if revenue.trending.negative
    feel: guide     if user.confused
    # DRISHTI detects emotion → updates CSS vars
    # Aurora, blur, speed, scale — all adapt automatically`));
  card.appendChild(preview);
  card.appendChild(simLabel);
  card.appendChild(simBtns);
  card.appendChild(varsLabel);
  card.appendChild(varsDisplay);
  wrap.appendChild(card);
  return wrap;
}

// ── Tab: Healing ──────────────────────────────────────────────────────────
function tabHealing(): HTMLElement {
  const wrap = el('div', 'display:flex;flex-direction:column;gap:20px;');
  wrap.appendChild(sectionHead(
    '③ Self-Healing — <span style="color:#10b981">Zero Try/Catch</span>',
    'Declare <code style="color:#a78bfa;font-size:.85em">heal: retry(3)</code> in your component. DRISHTI handles all failure states, retries, and fallbacks automatically.',
  ));

  const card = glassCard();

  const status  = signal<'idle'|'loading'|'healing'|'ready'|'failed'>('idle');
  const attempt = signal(0);
  const logs    = signal<{ type: string; msg: string }[]>([]);

  const addLog = (type: string, msg: string) =>
    logs.set([...logs.peek(), { type, msg: `${new Date().toLocaleTimeString()} — ${msg}` }]);

  const runHeal = async () => {
    status.set('loading'); attempt.set(0); logs.set([]);
    addLog('ok', 'Component mounted — fetching data…');
    let fails = 0;
    for (let i = 1; i <= 3; i++) {
      attempt.set(i);
      await sleep(700);
      fails++;
      if (fails < 3) {
        status.set('healing');
        addLog('warn', `Attempt ${i}/3 failed — backing off ${500 * i}ms`);
        await sleep(500 * i);
      } else {
        status.set('ready');
        addLog('ok', 'Recovered ✓  Data loaded after 3 attempts');
        return;
      }
    }
    status.set('failed');
    addLog('err', 'All retries exhausted → rendering fallback UI');
  };

  const STATUS_CFG = {
    idle:    { label: 'IDLE',    color: '#475569', glow: 'transparent' },
    loading: { label: 'LOADING', color: '#60a5fa', glow: 'rgba(59,130,246,.3)' },
    healing: { label: 'HEALING', color: '#f59e0b', glow: 'rgba(245,158,11,.3)' },
    ready:   { label: 'READY',   color: '#10b981', glow: 'rgba(16,185,129,.3)' },
    failed:  { label: 'FAILED',  color: '#f43f5e', glow: 'rgba(244,63,94,.3)'  },
  };

  const statusBadge = el('div', 'margin-bottom:16px;');
  statusBadge.className = 'badge';
  effect(() => {
    const s = STATUS_CFG[status()];
    statusBadge.textContent   = s.label;
    statusBadge.style.color   = s.color;
    statusBadge.style.background = `${s.color}18`;
    statusBadge.style.borderColor= `${s.color}44`;
    statusBadge.style.boxShadow  = `0 0 12px ${s.glow}`;
  });

  const attemptBar = el('div', 'margin-bottom:16px;');
  effect(() => {
    const a = attempt();
    attemptBar.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
      const dot = el('span', `
        display:inline-block;width:10px;height:10px;border-radius:50%;
        margin-right:6px;transition:all 400ms ease;
        background:${i <= a ? (status.peek() === 'ready' ? '#10b981' : '#f59e0b') : 'rgba(255,255,255,.1)'};
        box-shadow:${i <= a ? `0 0 8px ${status.peek()==='ready' ? '#10b981' : '#f59e0b'}` : 'none'};
      `);
      attemptBar.appendChild(dot);
    }
    const t = el('span', 'color:#475569;font-size:.75rem;font-family:var(--font-mono);vertical-align:middle;');
    t.textContent = attempt() > 0 ? `  attempt ${attempt()}/3` : '  waiting';
    attemptBar.appendChild(t);
  });

  const logEl = el('div', 'max-height:120px;margin-bottom:20px;');
  logEl.className = 'terminal';
  effect(() => {
    logEl.innerHTML = logs().map(l =>
      `<div class="log-${l.type}">${l.msg}</div>`
    ).join('') || '<span style="color:#334155">Press the button to simulate…</span>';
    logEl.scrollTop = logEl.scrollHeight;
  });

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = '▶  Simulate Failure + Auto-Heal';
  btn.addEventListener('click', () => void runHeal());

  card.appendChild(drCode(
`unit: OrderData
  data: connect(api.orders, realtime)
  heal: retry(3) then empty-state

# No try/catch in your code.
# DRISHTI runtime handles:
#   → exponential backoff retry
#   → live status feedback
#   → graceful fallback UI`));
  card.appendChild(statusBadge);
  card.appendChild(attemptBar);
  card.appendChild(logEl);
  card.appendChild(btn);
  wrap.appendChild(card);
  return wrap;
}

// ── Tab: Security ─────────────────────────────────────────────────────────
function tabSecurity(): HTMLElement {
  const wrap = el('div', 'display:flex;flex-direction:column;gap:20px;');
  wrap.appendChild(sectionHead(
    '④ Zero-Trust Security — <span style="color:#f43f5e">Always On</span>',
    'Every input is sanitized at the boundary. XSS, script injection, and unsafe URLs are blocked <em>before</em> reaching the DOM.',
  ));

  const card = glassCard();
  const inputSig   = signal('');
  const resultSig  = signal('');
  const blockedSig = signal(false);

  const TESTS = [
    { label: '✓ Normal text',   value: 'Hello Naveen, welcome back!' },
    { label: '⚠ XSS attempt',   value: '<img src=x onerror="alert(\'XSS\')">' },
    { label: '⚠ Script inject', value: '<script>document.cookie</script>' },
    { label: '⚠ SQL inject',    value: "'; DROP TABLE users; --" },
    { label: '⚠ URL inject',    value: '<a href="javascript:void(0)">Click</a>' },
  ];

  effect(() => {
    const raw = inputSig();
    const div = document.createElement('div');
    div.textContent = raw;
    const safe = div.innerHTML;
    resultSig.set(safe);
    blockedSig.set(safe !== raw && raw.length > 0);
  });

  const inputEl = document.createElement('textarea');
  inputEl.placeholder = 'Type anything, or pick a test below…';
  inputEl.className = 'dr-input';
  inputEl.style.cssText += 'min-height:64px;resize:vertical;font-family:var(--font-mono);font-size:.8rem;';
  inputEl.addEventListener('input', () => inputSig.set(inputEl.value));

  const testBtns = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;margin-bottom:20px;');
  for (const t of TESTS) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost';
    btn.style.cssText += 'font-size:.75rem;padding:5px 10px;';
    btn.textContent = t.label;
    btn.addEventListener('click', () => { inputEl.value = t.value; inputSig.set(t.value); });
    testBtns.appendChild(btn);
  }

  const resultBox = el('div', `
    padding:14px 16px; border-radius:var(--radius-md);
    font-family:var(--font-mono); font-size:.8rem; line-height:1.7;
    border:1px solid; transition:all 500ms ease;
    word-break:break-all; min-height:48px;
  `);
  const resultLabel = el('div', 'font-size:.72rem;color:#475569;margin-bottom:8px;letter-spacing:0.03em;font-family:var(--font-mono);');

  effect(() => {
    const blocked = blockedSig();
    const safe    = resultSig();
    resultBox.textContent      = safe || '—';
    resultBox.style.background = blocked ? 'rgba(16,185,129,.07)'  : 'rgba(0,0,0,.3)';
    resultBox.style.borderColor= blocked ? 'rgba(16,185,129,.3)'   : 'rgba(255,255,255,.06)';
    resultBox.style.color      = blocked ? '#10b981' : '#94a3b8';
    resultLabel.textContent    = blocked
      ? '✓ Attack neutralised — safe HTML output:'
      : '○ Sanitized output:';
    resultLabel.style.color    = blocked ? '#10b981' : '#475569';
  });

  card.appendChild(drCode(
`unit: CommentBox
  data: connect(api.comments)
  trust: sanitized        # compiler injects sanitize()

# No DOMPurify to install. No manual escaping.
# Any innerHTML without trust: sanitized
# → COMPILE ERROR, not a runtime bug.`));
  card.appendChild(inputEl);
  card.appendChild(testBtns);
  card.appendChild(resultLabel);
  card.appendChild(resultBox);
  wrap.appendChild(card);
  return wrap;
}

// ── Tab: Compiler ─────────────────────────────────────────────────────────
function tabCompiler(): HTMLElement {
  const wrap = el('div', 'display:flex;flex-direction:column;gap:20px;');
  wrap.appendChild(sectionHead(
    '⑤ The .dr Language — <span style="color:#60a5fa">Live Compiler</span>',
    'Write intent. The compiler generates TypeScript. Edit the left panel — output updates in real time.',
  ));

  const DEFAULT = `surface: OrdersDashboard
  intent: show customer orders to managers
  secure: role(manager)

  unit: RevenueCard
    data: connect(api.revenue, realtime)
    feel: celebrate if trending.positive
    feel: calm-alert if trending.negative
    heal: retry(3) then empty-state
    secure: role(manager, finance)
    layout: grid(2)

  unit: OrderTable
    data: connect(api.orders)
    columns: [customer, amount, status, date]
    heal: auto
    adapt: user.history
    on: row-click then open-detail`;

  const grid = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:16px;');

  // Input
  const inputPanel = el('div', 'border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--c-border);');
  const inputHead  = buildEditorHeader('orders.dr', '#a78bfa');
  const textarea   = document.createElement('textarea');
  textarea.value     = DEFAULT;
  textarea.style.cssText = `
    width:100%; min-height:380px; padding:16px;
    background:rgba(0,0,0,.5); color:#cdd6f4;
    border:none; outline:none; resize:vertical;
    font-family:var(--font-mono); font-size:.78rem;
    line-height:1.7; tab-size:2; box-sizing:border-box;
  `;
  inputPanel.appendChild(inputHead);
  inputPanel.appendChild(textarea);

  // Output
  const outputPanel = el('div', 'border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--c-border);display:flex;flex-direction:column;');
  const outHead     = buildEditorHeader('generated.ts', '#60a5fa');
  const timing      = el('span', 'font-size:.7rem;font-family:var(--font-mono);color:#10b981;margin-left:auto;');
  outHead.appendChild(timing);
  const output = document.createElement('pre');
  output.style.cssText = `
    margin:0; flex:1; min-height:380px; padding:16px;
    background:rgba(0,0,0,.6); color:#e6edf3;
    font-family:var(--font-mono); font-size:.78rem;
    line-height:1.7; overflow:auto;
  `;
  const errEl = el('div', 'display:none;padding:10px 14px;background:rgba(244,63,94,.1);border-top:1px solid rgba(244,63,94,.3);color:#f87171;font-family:var(--font-mono);font-size:.75rem;white-space:pre-wrap;');
  outputPanel.appendChild(outHead);
  outputPanel.appendChild(output);
  outputPanel.appendChild(errEl);

  grid.appendChild(inputPanel);
  grid.appendChild(outputPanel);

  // Lazy compiler load
  let compileFn: ((s: string) => { code: string; errors: string[] }) | null = null;
  timing.textContent = 'loading compiler…';

  import('@nexoraaidrishti/compiler').then(m => {
    compileFn = m.compile;
    run(textarea.value);
  });

  const run = (src: string) => {
    if (!compileFn) return;
    const t0 = performance.now();
    const r   = compileFn(src);
    timing.textContent = `✓ ${(performance.now()-t0).toFixed(1)}ms`;
    if (r.errors.length) {
      errEl.style.display = 'block'; errEl.textContent = r.errors.join('\n'); output.textContent = '';
    } else {
      errEl.style.display = 'none'; output.textContent = r.code;
    }
  };

  let debounce: ReturnType<typeof setTimeout>;
  textarea.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => run(textarea.value), 400); });

  wrap.appendChild(grid);
  return wrap;
}

function buildEditorHeader(filename: string, dotColor: string): HTMLElement {
  const head = el('div', `
    background:rgba(0,0,0,.4);
    padding:10px 16px;
    display:flex; align-items:center; gap:6px;
    border-bottom:1px solid rgba(255,255,255,.06);
  `);
  ['#ff5f57','#febc2e','#28c840'].forEach(c => {
    const d = el('span', `width:10px;height:10px;border-radius:50%;background:${c};display:inline-block;`);
    head.appendChild(d);
  });
  const name = el('span', `color:${dotColor};font-size:.75rem;font-family:var(--font-mono);margin-left:6px;`);
  name.textContent = filename;
  head.appendChild(name);
  return head;
}

// ── Utils ─────────────────────────────────────────────────────────────────
function el(tag: string, css: string): HTMLElement {
  const e = document.createElement(tag);
  if (css.includes(':')) e.style.cssText = css;
  else if (css) e.className = css;
  return e;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

buildApp();
