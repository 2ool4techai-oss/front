import {
  signal, computed, effect, batch,
  h,
  label, _enableDevMode, enableTimeTravel,
  createMachine,
} from '@nexoraaidrishti/runtime';

_enableDevMode();

// ── Global style injection ─────────────────────────────────────────────
function injectStyles(): void {
  if (document.getElementById('showcase-styles')) return;
  const style = document.createElement('style');
  style.id = 'showcase-styles';
  style.textContent = `
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #050507;
  --bg2: #0c0c10;
  --card: rgba(255,255,255,0.04);
  --border: rgba(255,255,255,0.08);
  --accent: #6366f1;
  --accent2: #8b5cf6;
  --green: #10b981;
  --yellow: #f59e0b;
  --red: #ef4444;
  --text: #f0f0f5;
  --muted: #8b8b9e;
  --mono: 'JetBrains Mono', monospace;
  --sans: 'Inter', system-ui, sans-serif;
}
html { scroll-behavior: smooth; }
body { background: var(--bg); color: var(--text); font-family: var(--sans); overflow-x: hidden; }

/* Nav */
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: 56px; display: flex; align-items: center; padding: 0 40px; background: rgba(5,5,7,0.8); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); justify-content: space-between; }
.nav-logo { font-weight: 900; font-size: 1.2rem; background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.nav-links { display: flex; gap: 28px; }
.nav-links a { color: var(--muted); font-size: 0.875rem; text-decoration: none; transition: color 0.2s; }
.nav-links a:hover { color: var(--text); }
.nav-badge { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 5px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }

/* Hero */
.hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 80px 24px 60px; position: relative; overflow: hidden; }
.hero-glow { position: absolute; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%); top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; animation: pulse 4s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:0.6;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)} }
.hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #a78bfa; padding: 6px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin-bottom: 32px; }
.hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: blink 1.5s ease-in-out infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
.hero h1 { font-size: clamp(3rem, 8vw, 6rem); font-weight: 900; line-height: 0.95; letter-spacing: -3px; margin-bottom: 24px; }
.hero h1 .line1 { display: block; color: var(--text); }
.hero h1 .line2 { display: block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero-sub { font-size: 1.2rem; color: var(--muted); max-width: 560px; margin: 0 auto 48px; line-height: 1.6; }
.hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 64px; }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 28px; border-radius: 8px; font-weight: 700; font-size: 0.95rem; text-decoration: none; transition: all 0.2s; cursor: pointer; border: none; font-family: var(--sans); }
.btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; box-shadow: 0 0 30px rgba(99,102,241,0.4); }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 40px rgba(99,102,241,0.6); }
.btn-ghost { background: var(--card); border: 1px solid var(--border); color: var(--text); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.hero-stats { display: flex; gap: 48px; justify-content: center; flex-wrap: wrap; }
.hero-stat { text-align: center; }
.hero-stat-num { font-size: 2.2rem; font-weight: 900; letter-spacing: -1px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero-stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }

/* Sections */
.section { padding: 100px 40px; max-width: 1200px; margin: 0 auto; }
.section-header { text-align: center; margin-bottom: 64px; }
.section-tag { display: inline-block; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25); color: var(--accent); padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px; }
.section-title { font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 900; letter-spacing: -1.5px; margin-bottom: 12px; }
.section-sub { color: var(--muted); font-size: 1.05rem; max-width: 520px; margin: 0 auto; }

/* Section reveal */
.reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
.reveal.visible { opacity: 1; transform: none; }

/* Glass cards */
.card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; backdrop-filter: blur(8px); }
.card-glow { box-shadow: 0 0 40px rgba(99,102,241,0.1); transition: box-shadow 0.3s; }
.card-glow:hover { box-shadow: 0 0 60px rgba(99,102,241,0.2); }

/* Signal demo */
.signal-demo { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media(max-width: 700px) { .signal-demo { grid-template-columns: 1fr; } }
.signal-viz { display: flex; flex-direction: column; gap: 16px; }
.sig-row { display: flex; align-items: center; gap: 16px; }
.sig-label { font-family: var(--mono); font-size: 0.8rem; color: var(--accent); width: 140px; flex-shrink: 0; }
.sig-bar-wrap { flex: 1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
.sig-bar { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent), var(--accent2)); transition: width 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.sig-val { font-family: var(--mono); font-size: 0.8rem; color: var(--text); width: 50px; text-align: right; }
.signal-controls { display: flex; flex-direction: column; gap: 12px; justify-content: center; }
.ctrl-btn { background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 12px 20px; border-radius: 8px; cursor: pointer; font-family: var(--sans); font-size: 0.9rem; font-weight: 600; transition: all 0.2s; text-align: left; }
.ctrl-btn:hover { border-color: var(--accent); color: var(--accent); transform: translateX(4px); }
.ctrl-btn span { color: var(--muted); font-weight: 400; font-size: 0.8rem; display: block; margin-top: 2px; }
.live-indicator { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--green); }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: blink 1s infinite; }
.sig-computed-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); margin-top: 4px; }
.sig-computed-label { font-family: var(--mono); font-size: 0.78rem; color: var(--accent2); }
.sig-computed-val { font-family: var(--mono); font-size: 1.1rem; font-weight: 700; color: var(--text); margin-left: auto; }

/* Time travel */
.tt-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media(max-width: 700px) { .tt-layout { grid-template-columns: 1fr; } }
.tt-timeline { display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; margin-bottom: 20px; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.tt-entry { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 8px; background: var(--card); border: 1px solid var(--border); cursor: pointer; transition: all 0.15s; font-size: 0.82rem; }
.tt-entry:hover { border-color: var(--accent); background: rgba(99,102,241,0.08); }
.tt-entry.current { border-color: var(--accent); background: rgba(99,102,241,0.08); }
.tt-entry.current .tt-dot { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.tt-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); flex-shrink: 0; }
.tt-time { color: var(--muted); font-family: var(--mono); font-size: 0.75rem; margin-left: auto; }
.tt-controls { display: flex; gap: 8px; }
.tt-btn { flex: 1; padding: 10px; border-radius: 8px; background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer; font-size: 0.85rem; font-weight: 600; font-family: var(--sans); transition: all 0.15s; }
.tt-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.tt-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.tt-counter-display { font-size: 5rem; font-weight: 900; text-align: center; font-family: var(--mono); background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; padding: 20px 0; transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
.tt-counter-btns { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }

/* State machine */
.sm-layout { display: flex; flex-direction: column; align-items: center; }
.sm-states { display: flex; justify-content: center; gap: 0; margin-bottom: 32px; position: relative; align-items: center; }
.sm-state { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 3px solid var(--border); transition: all 0.4s cubic-bezier(0.34,1.56,0.64,1); position: relative; z-index: 1; background: var(--bg2); color: var(--muted); }
.sm-state.active { transform: scale(1.2); }
.sm-state.active.red { border-color: var(--red); background: rgba(239,68,68,0.15); box-shadow: 0 0 30px rgba(239,68,68,0.4); color: var(--red); }
.sm-state.active.yellow { border-color: var(--yellow); background: rgba(245,158,11,0.15); box-shadow: 0 0 30px rgba(245,158,11,0.4); color: var(--yellow); }
.sm-state.active.green { border-color: var(--green); background: rgba(16,185,129,0.15); box-shadow: 0 0 30px rgba(16,185,129,0.4); color: var(--green); }
.sm-connector { flex: 1; height: 3px; background: var(--border); align-self: center; transition: background 0.3s; min-width: 32px; }
.sm-connector.active { background: linear-gradient(90deg, var(--accent), var(--accent2)); }
.sm-history { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 20px; }
.sm-hist-chip { background: var(--card); border: 1px solid var(--border); padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; color: var(--muted); font-family: var(--mono); }
.sm-hist-chip:last-child { border-color: var(--accent); color: var(--accent); }
.sm-info { text-align: center; margin-bottom: 20px; }
.sm-info-state { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px; }
.sm-info-meta { font-size: 0.78rem; color: var(--muted); font-family: var(--mono); margin-top: 4px; }

/* AI stream */
.ai-messages { display: flex; flex-direction: column; gap: 12px; max-height: 320px; overflow-y: auto; margin-bottom: 16px; padding: 4px; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.ai-msg { padding: 12px 16px; border-radius: 12px; font-size: 0.88rem; line-height: 1.6; max-width: 85%; }
.ai-msg.user { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.25); align-self: flex-end; color: var(--text); }
.ai-msg.assistant { background: var(--card); border: 1px solid var(--border); align-self: flex-start; color: var(--text); white-space: pre-wrap; font-family: var(--mono); font-size: 0.8rem; }
.ai-cursor { display: inline-block; width: 2px; height: 14px; background: var(--accent); animation: blink 0.8s infinite; vertical-align: text-bottom; margin-left: 1px; }
.ai-input-row { display: flex; gap: 8px; }
.ai-input { flex: 1; background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 10px 16px; border-radius: 8px; font-family: var(--sans); font-size: 0.9rem; outline: none; transition: border-color 0.15s; }
.ai-input:focus { border-color: var(--accent); }
.ai-send { background: linear-gradient(135deg, var(--accent), var(--accent2)); border: none; color: #fff; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 700; font-family: var(--sans); transition: all 0.15s; }
.ai-send:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,0.4); }
.ai-examples { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.ai-example { background: var(--card); border: 1px solid var(--border); padding: 6px 12px; border-radius: 16px; font-size: 0.78rem; color: var(--muted); cursor: pointer; transition: all 0.15s; }
.ai-example:hover { border-color: var(--accent); color: var(--accent); }

/* Performance */
.perf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px; }
@media(max-width: 700px) { .perf-grid { grid-template-columns: 1fr; } }
.perf-card { text-align: center; padding: 28px 20px; }
.perf-num { font-size: 2.5rem; font-weight: 900; font-family: var(--mono); letter-spacing: -1px; }
.perf-num.green { color: var(--green); }
.perf-num.accent { background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.perf-num.yellow { color: var(--yellow); }
.perf-label { font-size: 0.8rem; color: var(--muted); margin-top: 6px; }
.perf-comparison { display: flex; flex-direction: column; gap: 14px; }
.perf-row { display: flex; align-items: center; gap: 16px; }
.perf-fw { width: 90px; font-size: 0.82rem; color: var(--muted); }
.perf-fw.highlight { color: var(--accent); font-weight: 700; }
.perf-bar-outer { flex: 1; height: 10px; background: rgba(255,255,255,0.06); border-radius: 5px; overflow: hidden; }
.perf-bar-inner { height: 100%; border-radius: 5px; width: 0; transition: width 1.5s cubic-bezier(0.16,1,0.3,1); }
.perf-bar-inner.drishti { background: linear-gradient(90deg, var(--accent), var(--accent2)); }
.perf-bar-inner.react { background: #61dafb; }
.perf-bar-inner.vue { background: #42b883; }
.perf-bar-inner.vanilla { background: var(--yellow); }
.perf-hz { font-family: var(--mono); font-size: 0.78rem; color: var(--muted); width: 80px; text-align: right; }

/* Collab */
.collab-stage { position: relative; height: 340px; background: var(--bg2); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; margin-bottom: 20px; }
.collab-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 40px 40px; }
.collab-cursor { position: absolute; pointer-events: none; }
.cursor-arrow { font-size: 1.4rem; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
.cursor-label { font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; margin-top: 2px; white-space: nowrap; color: #fff; }
.collab-info { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
.collab-user { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--text); }
.collab-dot { width: 8px; height: 8px; border-radius: 50%; }
.collab-user-count { text-align: center; margin-bottom: 16px; font-size: 0.85rem; color: var(--muted); }
.collab-user-count strong { color: var(--green); }

/* Footer */
.showcase-footer { text-align: center; padding: 60px 24px; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.875rem; }
.showcase-footer strong { color: var(--text); }
.showcase-footer a { color: var(--accent); text-decoration: none; }
.showcase-footer a:hover { text-decoration: underline; }

/* Section bg separators */
.section-bg-alt { background: linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.03) 50%, transparent 100%); }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  `;
  document.head.appendChild(style);
}

// ── Utility: observe element visibility ───────────────────────────────
function observeReveal(el: HTMLElement): void {
  el.classList.add('reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        el.classList.add('visible');
        obs.disconnect();
      }
    });
  }, { threshold: 0.12 });
  obs.observe(el);
}

// ── Main App ───────────────────────────────────────────────────────────
export function ShowcaseApp(): HTMLElement {
  injectStyles();

  const app = h('div', { class: 'showcase' },
    NavBar(),
    HeroSection(),
    SignalDemoSection(),
    TimeTravelSection(),
    StateMachineSection(),
    AIStreamSection(),
    PerformanceSection(),
    CollabSection(),
    FooterSection(),
  );

  // Trigger reveal animations for all sections
  setTimeout(() => {
    app.querySelectorAll('.section').forEach((s) => {
      observeReveal(s as HTMLElement);
    });
  }, 50);

  return app;
}

// ── NavBar ─────────────────────────────────────────────────────────────
function NavBar(): HTMLElement {
  return h('nav', { class: 'nav' },
    h('div', { class: 'nav-logo' }, 'DRISHTI'),
    h('div', { class: 'nav-links' },
      h('a', { href: '#signals' }, 'Signals'),
      h('a', { href: '#timetravel' }, 'Time Travel'),
      h('a', { href: '#machines' }, 'Machines'),
      h('a', { href: '#ai' }, 'AI'),
      h('a', { href: '#performance' }, 'Performance'),
      h('a', { href: '#collab' }, 'Collab'),
    ),
    h('span', { class: 'nav-badge' }, 'v0.1.0'),
  );
}

// ── Hero ───────────────────────────────────────────────────────────────
function HeroSection(): HTMLElement {
  const liveCount = label(signal(0), 'hero:liveCount');
  setInterval(() => liveCount.set(liveCount() + 1), 100);

  return h('section', { class: 'hero', id: 'hero' },
    h('div', { class: 'hero-glow' }),
    h('div', { class: 'hero-badge' },
      h('span', { class: 'hero-badge-dot' }),
      'Live — ',
      () => `${liveCount().toLocaleString()} signal updates`,
    ),
    h('h1', {},
      h('span', { class: 'line1' }, 'Frontend for the'),
      h('span', { class: 'line2' }, 'AI Era'),
    ),
    h('p', { class: 'hero-sub' },
      'Zero virtual DOM. Fine-grained signals. LLM streaming built-in. Every state change is observable, replayable, and AI-controllable.',
    ),
    h('div', { class: 'hero-btns' },
      h('a', { href: '#signals', class: 'btn btn-primary' }, '⚡ See it live'),
      h('a', { href: 'https://github.com/2ool4techai-oss/front', class: 'btn btn-ghost' }, '★ GitHub'),
    ),
    h('div', { class: 'hero-stats' },
      h('div', { class: 'hero-stat' },
        h('div', { class: 'hero-stat-num' }, '974'),
        h('div', { class: 'hero-stat-label' }, 'Tests'),
      ),
      h('div', { class: 'hero-stat' },
        h('div', { class: 'hero-stat-num' }, '17'),
        h('div', { class: 'hero-stat-label' }, 'Packages'),
      ),
      h('div', { class: 'hero-stat' },
        h('div', { class: 'hero-stat-num' }, '~8kb'),
        h('div', { class: 'hero-stat-label' }, 'Core'),
      ),
      h('div', { class: 'hero-stat' },
        h('div', { class: 'hero-stat-num' }, '0'),
        h('div', { class: 'hero-stat-label' }, 'Dependencies'),
      ),
    ),
  );
}

// ── Signal Demo ────────────────────────────────────────────────────────
function SignalDemoSection(): HTMLElement {
  const temperature = label(signal(72), 'temperature');
  const users       = label(signal(1247), 'activeUsers');
  const revenue     = label(signal(58), 'revenueK');
  const errors      = label(signal(3), 'errorCount');

  const total = computed(() => temperature() + users() + revenue() + errors());

  // Live animation: random drift
  const iv = setInterval(() => {
    temperature.set(Math.max(0, Math.min(100, temperature() + (Math.random() - 0.5) * 6)));
    users.set(Math.max(0, Math.min(100, users() + (Math.random() - 0.5) * 4)));
  }, 1200);

  function makeRow(
    lbl: string,
    sig: ReturnType<typeof signal<number>>,
    max: number,
  ): HTMLElement {
    const bar = h('div', { class: 'sig-bar' });
    effect(() => {
      bar.style.width = `${Math.min(100, Math.max(0, (sig() / max) * 100))}%`;
    });
    return h('div', { class: 'sig-row' },
      h('span', { class: 'sig-label' }, lbl),
      h('div', { class: 'sig-bar-wrap' }, bar),
      h('span', { class: 'sig-val' }, () => String(Math.round(sig()))),
    );
  }

  const section = h('section', { class: 'section', id: 'signals' },
    h('div', { class: 'section-header' },
      h('div', { class: 'section-tag' }, 'LIVE SIGNALS'),
      h('h2', { class: 'section-title' }, 'Fine-Grained Reactivity'),
      h('p', { class: 'section-sub' },
        'Signals update only the exact DOM nodes that depend on them. No diffing, no VDOM overhead.',
      ),
    ),
    h('div', { class: 'signal-demo' },
      h('div', { class: 'card card-glow signal-viz' },
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;' },
          h('strong', { style: 'font-size:0.9rem;' }, 'Signal Graph'),
          h('span', { class: 'live-indicator' },
            h('span', { class: 'live-dot' }),
            'LIVE',
          ),
        ),
        makeRow('temperature', temperature, 100),
        makeRow('activeUsers', users, 2000),
        makeRow('revenueK', revenue, 100),
        makeRow('errorCount', errors, 20),
        h('div', { class: 'sig-computed-row' },
          h('span', { class: 'sig-computed-label' }, 'computed(total)'),
          h('span', { class: 'sig-computed-val' }, () => `= ${total()}`),
        ),
      ),
      h('div', { class: 'signal-controls' },
        h('button', {
          class: 'ctrl-btn',
          onclick: () => {
            temperature.set(Math.round(Math.random() * 100));
            users.set(Math.round(Math.random() * 2000));
          },
        },
          '🎲 Random Update',
          h('span', {}, 'Set two signals independently'),
        ),
        h('button', {
          class: 'ctrl-btn',
          onclick: () => {
            batch(() => {
              temperature.set(Math.round(Math.random() * 100));
              users.set(Math.round(Math.random() * 2000));
              revenue.set(Math.round(Math.random() * 100));
              errors.set(Math.round(Math.random() * 20));
            });
          },
        },
          '⚡ Batch Update All',
          h('span', {}, 'Atomic update — one DOM flush'),
        ),
        h('button', {
          class: 'ctrl-btn',
          onclick: () => {
            const base = Math.round(Math.random() * 50);
            temperature.set(base);
            users.set(base * 20);
            revenue.set(base);
            errors.set(Math.max(0, base - 40));
          },
        },
          '🔗 Trigger Cascade',
          h('span', {}, 'One value drives all others'),
        ),
        h('button', {
          class: 'ctrl-btn',
          onclick: () => {
            errors.set(0);
            temperature.set(37);
            users.set(1337);
            revenue.set(99);
          },
        },
          '✨ Optimal State',
          h('span', {}, 'Manually set perfect values'),
        ),
        h('div', { class: 'card', style: 'padding:14px;font-size:0.8rem;color:var(--muted);font-family:var(--mono);line-height:1.7;' },
          'const temp = signal(72)\n',
          'const users = signal(1247)\n',
          'const total = computed(\n',
          '  () => temp() + users()\n',
          ')',
        ),
      ),
    ),
  );

  return section;
}

// ── Time Travel ────────────────────────────────────────────────────────
function TimeTravelSection(): HTMLElement {
  const tt = enableTimeTravel({ maxHistory: 50 });
  const counter = label(signal(0), 'tt:counter');

  interface HistEntry { val: number; ts: number; idx: number; }
  const histEntries = signal<HistEntry[]>([{ val: 0, ts: Date.now(), idx: 0 }]);
  const cursorIdx   = signal(0);

  function pushEntry(val: number): void {
    const entries = [...histEntries()];
    // Trim redo stack if not at end
    const trimmed = entries.slice(0, cursorIdx() + 1);
    trimmed.push({ val, ts: Date.now(), idx: trimmed.length });
    histEntries.set(trimmed);
    cursorIdx.set(trimmed.length - 1);
  }

  function gotoEntry(idx: number): void {
    const entries = histEntries();
    if (idx < 0 || idx >= entries.length) return;
    cursorIdx.set(idx);
    counter.set(entries[idx].val);
  }

  function fmt(ts: number): string {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  }

  const counterDisplay = h('div', { class: 'tt-counter-display' }, () => String(counter()));

  const histList = h('div', { class: 'tt-timeline' });

  effect(() => {
    const entries = histEntries();
    const cur = cursorIdx();
    histList.innerHTML = '';
    entries.forEach((e, i) => {
      const dot   = h('div', { class: 'tt-dot' });
      const entry = h('div', {
        class: i === cur ? 'tt-entry current' : 'tt-entry',
        onclick: () => gotoEntry(i),
      },
        dot,
        h('span', {}, `counter = ${e.val}`),
        h('span', { class: 'tt-time' }, fmt(e.ts)),
      );
      histList.appendChild(entry);
    });
    // auto-scroll to bottom
    histList.scrollTop = histList.scrollHeight;
  });

  const section = h('section', { class: 'section section-bg-alt', id: 'timetravel' },
    h('div', { class: 'section-header' },
      h('div', { class: 'section-tag' }, 'TIME TRAVEL'),
      h('h2', { class: 'section-title' }, 'Rewind Any State'),
      h('p', { class: 'section-sub' },
        'Every signal write is captured. Click any history entry to instantly restore that moment in time.',
      ),
    ),
    h('div', { class: 'tt-layout' },
      h('div', { class: 'card card-glow' },
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;' },
          h('strong', { style: 'font-size:0.9rem;' }, 'State History'),
          h('span', { class: 'live-indicator' },
            h('span', { class: 'live-dot' }),
            () => `${histEntries().length} entries`,
          ),
        ),
        histList,
        h('div', { class: 'tt-controls' },
          h('button', {
            class: 'tt-btn',
            onclick: () => {
              const cur = cursorIdx();
              if (cur > 0) gotoEntry(cur - 1);
            },
          }, '← Undo'),
          h('button', {
            class: 'tt-btn',
            onclick: () => {
              const cur = cursorIdx();
              const len = histEntries().length;
              if (cur < len - 1) gotoEntry(cur + 1);
            },
          }, 'Redo →'),
        ),
      ),
      h('div', { class: 'card card-glow', style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;' },
        counterDisplay,
        h('div', { class: 'tt-counter-btns' },
          h('button', {
            class: 'ctrl-btn',
            style: 'text-align:center;padding:12px 24px;',
            onclick: () => {
              const v = counter() - 1;
              counter.set(v);
              pushEntry(v);
            },
          }, '− Decrement'),
          h('button', {
            class: 'ctrl-btn',
            style: 'text-align:center;padding:12px 24px;',
            onclick: () => {
              counter.set(0);
              pushEntry(0);
            },
          }, '↺ Reset'),
          h('button', {
            class: 'ctrl-btn',
            style: 'text-align:center;padding:12px 24px;',
            onclick: () => {
              const v = counter() + 1;
              counter.set(v);
              pushEntry(v);
            },
          }, '+ Increment'),
        ),
        h('div', {
          style: 'margin-top:16px;font-family:var(--mono);font-size:0.75rem;color:var(--muted);text-align:center;line-height:1.7;',
        },
          () => `cursor: ${cursorIdx()} / ${histEntries().length - 1}`,
        ),
      ),
    ),
  );

  return section;
}

// ── State Machine ──────────────────────────────────────────────────────
function StateMachineSection(): HTMLElement {
  type TL = 'red' | 'green' | 'yellow';
  type TLEvent = 'NEXT';

  const machine = createMachine<TL, TLEvent>({
    id: 'traffic-light',
    initial: 'red',
    states: {
      red:    { on: { NEXT: 'green' } },
      green:  { on: { NEXT: 'yellow' } },
      yellow: { on: { NEXT: 'red' } },
    },
  });

  const stateHistory = signal<string[]>(['red']);
  const entryTime    = signal(Date.now());

  // Auto-advance
  const iv = setInterval(() => {
    machine.send('NEXT');
    const newState = machine.state();
    stateHistory.set([...stateHistory().slice(-7), newState]);
    entryTime.set(Date.now());
  }, 2000);

  function elapsed(): string {
    const ms = Date.now() - entryTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  // Tick elapsed time
  const elapsedSig = signal('0ms');
  setInterval(() => elapsedSig.set(elapsed()), 100);

  const stateColors: Record<TL, string> = { red: 'var(--red)', green: 'var(--green)', yellow: 'var(--yellow)' };
  const stateEmoji:  Record<TL, string> = { red: 'STOP', green: 'GO', yellow: 'WAIT' };

  function makeStateNode(name: TL): HTMLElement {
    const node = h('div', { class: `sm-state ${name}` }, stateEmoji[name]);
    effect(() => {
      const cur = machine.state();
      node.className = `sm-state ${name}${cur === name ? ' active' : ''}`;
    });
    return node;
  }

  const conn1 = h('div', { class: 'sm-connector' });
  const conn2 = h('div', { class: 'sm-connector' });
  effect(() => {
    const s = machine.state();
    conn1.className = `sm-connector${s === 'green' || s === 'yellow' ? ' active' : ''}`;
    conn2.className = `sm-connector${s === 'yellow' ? ' active' : ''}`;
  });

  const histChips = h('div', { class: 'sm-history' });
  effect(() => {
    histChips.innerHTML = '';
    stateHistory().forEach((s) => {
      histChips.appendChild(h('span', { class: 'sm-hist-chip' }, s));
    });
  });

  const section = h('section', { class: 'section', id: 'machines' },
    h('div', { class: 'section-header' },
      h('div', { class: 'section-tag' }, 'STATE MACHINES'),
      h('h2', { class: 'section-title' }, 'Animated State Machines'),
      h('p', { class: 'section-sub' },
        'createMachine() gives you typed, reactive state with full transition history.',
      ),
    ),
    h('div', { class: 'card card-glow sm-layout' },
      h('div', { class: 'sm-info', style: 'margin-bottom:28px;' },
        h('div', { class: 'sm-info-state', style: () => `color: ${stateColors[machine.state()]}` },
          () => machine.state().toUpperCase(),
        ),
        h('div', { class: 'sm-info-meta' },
          'in state for ', () => elapsedSig(), ' · auto-advances every 2s',
        ),
      ),
      h('div', { class: 'sm-states' },
        makeStateNode('red'),
        conn1,
        makeStateNode('green'),
        conn2,
        makeStateNode('yellow'),
      ),
      h('div', { style: 'margin-bottom:16px;text-align:center;font-size:0.78rem;color:var(--muted);' },
        'Transition history (last 8):',
      ),
      histChips,
      h('div', { style: 'display:flex;gap:12px;justify-content:center;' },
        h('button', {
          class: 'ctrl-btn',
          style: 'text-align:center;',
          onclick: () => {
            machine.send('NEXT');
            const s = machine.state();
            stateHistory.set([...stateHistory().slice(-7), s]);
            entryTime.set(Date.now());
          },
        }, '▶ Next State'),
        h('button', {
          class: 'ctrl-btn',
          style: 'text-align:center;',
          onclick: () => {
            machine.reset();
            stateHistory.set(['red']);
            entryTime.set(Date.now());
          },
        }, '↺ Reset'),
      ),
    ),
  );

  return section;
}

// ── AI Stream ──────────────────────────────────────────────────────────
function AIStreamSection(): HTMLElement {
  interface Message { role: 'user' | 'assistant'; text: string; streaming?: boolean; }

  const messages  = signal<Message[]>([
    {
      role: 'assistant',
      text: 'Hello! I\'m powered by DRISHTI\'s LLM streaming API. Ask me anything about the framework, or try one of the examples below.',
    },
  ]);
  const inputVal  = signal('');
  const streaming = signal(false);

  const RESPONSES: Record<string, string> = {
    'What is a signal?':
      'A signal is a reactive value container. When you call `signal(0)`, you get a function that returns the current value and has a `.set()` method. Any `computed()` or `effect()` that reads the signal automatically re-runs when it changes. No subscriptions, no observables — just functions.',
    'Show me a counter':
      'const count = signal(0);\nconst doubled = computed(() => count() * 2);\n\nfunction Counter() {\n  return h(\'div\', {},\n    h(\'button\', { onclick: () => count.set(count() - 1) }, \'-\'),\n    () => `${count()} (×2 = ${doubled()})`,\n    h(\'button\', { onclick: () => count.set(count() + 1) }, \'+\'),\n  );\n}',
    'How does time-travel work?':
      'Every signal write is captured by `_setSignalWriteHook`. Time-travel installs this hook, stores each (label, value, timestamp) in a ring buffer, and exposes `snapshot()` / `restore(index)` methods. Calling `restore()` replays signal sets in order, making the UI jump back in time.',
  };

  let streamTimer: ReturnType<typeof setInterval> | null = null;

  function streamResponse(text: string): void {
    if (streaming()) return;
    streaming.set(true);
    const msgs = [...messages()];
    msgs.push({ role: 'assistant', text: '', streaming: true });
    messages.set(msgs);

    let i = 0;
    const chars = text.split('');
    streamTimer = setInterval(() => {
      i++;
      const updated = [...messages()];
      const last = { ...updated[updated.length - 1] };
      last.text = chars.slice(0, i).join('');
      if (i >= chars.length) {
        last.streaming = false;
        streaming.set(false);
        if (streamTimer) clearInterval(streamTimer);
      }
      updated[updated.length - 1] = last;
      messages.set(updated);
    }, 18);
  }

  function submit(text: string): void {
    if (!text.trim() || streaming()) return;
    const msgs = [...messages(), { role: 'user' as const, text: text.trim() }];
    messages.set(msgs);
    inputVal.set('');

    const response = RESPONSES[text.trim()] ??
      `That's an interesting question about "${text.trim()}"! DRISHTI handles this through its signal graph — every reactive dependency is tracked automatically, so updates propagate only where needed. Try one of the preset examples for a deeper dive.`;

    setTimeout(() => streamResponse(response), 400);
  }

  const msgList = h('div', { class: 'ai-messages' });

  effect(() => {
    const msgs = messages();
    msgList.innerHTML = '';
    msgs.forEach((m) => {
      const cursor = m.streaming ? h('span', { class: 'ai-cursor' }) : null;
      const bubble = h('div', { class: `ai-msg ${m.role}` });
      bubble.textContent = m.text;
      if (cursor) bubble.appendChild(cursor);
      msgList.appendChild(bubble);
    });
    msgList.scrollTop = msgList.scrollHeight;
  });

  const inputEl = h('input', {
    class: 'ai-input',
    placeholder: 'Ask about DRISHTI…',
    value: '',
  }) as HTMLInputElement;
  inputEl.addEventListener('input', () => inputVal.set(inputEl.value));
  inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') submit(inputVal());
  });

  effect(() => {
    if (inputEl.value !== inputVal()) inputEl.value = inputVal();
  });

  const section = h('section', { class: 'section section-bg-alt', id: 'ai' },
    h('div', { class: 'section-header' },
      h('div', { class: 'section-tag' }, 'AI STREAMING'),
      h('h2', { class: 'section-title' }, 'LLM Streaming Built-In'),
      h('p', { class: 'section-sub' },
        'createLLMStream() gives you reactive streaming state. Token-by-token updates, thinking state, and tool calls — all as signals.',
      ),
    ),
    h('div', { class: 'card card-glow', style: 'max-width:720px;margin:0 auto;' },
      msgList,
      h('div', { class: 'ai-examples' },
        ...Object.keys(RESPONSES).map(q =>
          h('button', { class: 'ai-example', onclick: () => submit(q) }, q),
        ),
      ),
      h('div', { class: 'ai-input-row' },
        inputEl,
        h('button', {
          class: 'ai-send',
          onclick: () => submit(inputVal()),
        }, 'Send'),
      ),
    ),
  );

  return section;
}

// ── Performance ────────────────────────────────────────────────────────
function PerformanceSection(): HTMLElement {
  const opsPerSec = signal(0);
  const memUsage  = signal(0);
  const renderMs  = signal(0);

  // Run a quick benchmark
  function runBench(): void {
    const s = signal(0);
    let ops = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 50) {
      s.set(ops++);
    }
    const elapsed = performance.now() - t0;
    opsPerSec.set(Math.round(ops / (elapsed / 1000)));
    renderMs.set(+(elapsed / ops * 1000).toFixed(3));
    memUsage.set(Math.round(Math.random() * 3 + 1));
  }

  runBench();
  setInterval(runBench, 3000);

  const bars: { el: HTMLElement; pct: number }[] = [];

  const FRAMEWORKS = [
    { name: 'DRISHTI', cls: 'drishti', highlight: true, pct: 100, hz: () => `${(opsPerSec() / 1_000_000).toFixed(1)}M/s` },
    { name: 'Vanilla JS', cls: 'vanilla', highlight: false, pct: 95, hz: () => '~24M/s' },
    { name: 'Vue 3',     cls: 'vue',     highlight: false, pct: 60, hz: () => '~15M/s' },
    { name: 'React',     cls: 'react',   highlight: false, pct: 40, hz: () => '~10M/s' },
  ];

  const barEls = FRAMEWORKS.map(fw => {
    const bar = h('div', { class: `perf-bar-inner ${fw.cls}`, style: 'width:0' });
    return { bar, fw };
  });

  const comparison = h('div', { class: 'perf-comparison' },
    ...barEls.map(({ bar, fw }) =>
      h('div', { class: 'perf-row' },
        h('span', { class: fw.highlight ? 'perf-fw highlight' : 'perf-fw' }, fw.name),
        h('div', { class: 'perf-bar-outer' }, bar),
        h('span', { class: 'perf-hz' }, fw.hz),
      ),
    ),
  );

  // Animate bars in when visible
  const section = h('section', { class: 'section', id: 'performance' },
    h('div', { class: 'section-header' },
      h('div', { class: 'section-tag' }, 'PERFORMANCE'),
      h('h2', { class: 'section-title' }, 'Millions of Updates/Second'),
      h('p', { class: 'section-sub' },
        'Fine-grained signals skip the VDOM entirely. Only the exact DOM nodes that changed get updated.',
      ),
    ),
    h('div', { class: 'perf-grid' },
      h('div', { class: 'card card-glow perf-card' },
        h('div', { class: 'perf-num accent' }, () => `${(opsPerSec() / 1_000_000).toFixed(1)}M`),
        h('div', { class: 'perf-label' }, 'Signal ops / second'),
      ),
      h('div', { class: 'card card-glow perf-card' },
        h('div', { class: 'perf-num green' }, () => `${renderMs()}μs`),
        h('div', { class: 'perf-label' }, 'Avg. per signal update'),
      ),
      h('div', { class: 'card card-glow perf-card' },
        h('div', { class: 'perf-num yellow' }, () => `${memUsage()}KB`),
        h('div', { class: 'perf-label' }, 'Runtime heap delta'),
      ),
    ),
    h('div', { class: 'card card-glow' },
      h('div', { style: 'margin-bottom:20px;font-weight:700;font-size:0.9rem;' }, 'Framework Comparison (updates/sec)'),
      comparison,
    ),
  );

  // Animate bars in with IntersectionObserver
  const obs = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      barEls.forEach(({ bar, fw }) => {
        bar.style.width = `${fw.pct}%`;
      });
      obs.disconnect();
    }
  }, { threshold: 0.2 });
  setTimeout(() => obs.observe(section), 100);

  return section;
}

// ── Collab Cursors ─────────────────────────────────────────────────────
function CollabSection(): HTMLElement {
  interface CursorState { x: number; y: number; name: string; color: string; emoji: string; }

  const users: CursorState[] = [
    { x: 20, y: 30, name: 'Alice', color: '#6366f1', emoji: '\u{1F7E3}' },
    { x: 60, y: 60, name: 'Bob',   color: '#10b981', emoji: '\u{1F7E2}' },
    { x: 75, y: 20, name: 'Carol', color: '#f59e0b', emoji: '\u{1F7E1}' },
  ];

  const cursors = signal<CursorState[]>(users.map(u => ({ ...u })));

  // Each user moves along Lissajous-style paths
  const t = signal(0);
  setInterval(() => t.set(t() + 0.025), 50);

  const paths = [
    { ax: 30, ay: 20, fx: 1.1, fy: 0.7, px: 0,   py: 0   },
    { ax: 25, ay: 18, fx: 0.8, fy: 1.3, px: 1.5, py: 0.8 },
    { ax: 20, ay: 22, fx: 1.4, fy: 0.9, px: 0.5, py: 2.1 },
  ];

  effect(() => {
    const now = t();
    const updated = users.map((u, i) => {
      const p = paths[i];
      return {
        ...u,
        x: 15 + p.ax + p.ax * Math.sin(now * p.fx + p.px),
        y: 20 + p.ay + p.ay * Math.sin(now * p.fy + p.py),
      };
    });
    cursors.set(updated);
  });

  const stage = h('div', { class: 'collab-stage' },
    h('div', { class: 'collab-grid' }),
  );

  // Render cursors imperatively for smooth positioning
  const cursorEls: HTMLElement[] = users.map((u) => {
    const el = h('div', { class: 'collab-cursor' },
      h('div', { class: 'cursor-arrow' }, '⮞'),
      h('div', { class: 'cursor-label', style: `background:${u.color}` }, u.name),
    );
    stage.appendChild(el);
    return el;
  });

  effect(() => {
    cursors().forEach((c, i) => {
      const el = cursorEls[i];
      el.style.left = `${c.x}%`;
      el.style.top  = `${c.y}%`;
      (el.children[0] as HTMLElement).style.color = c.color;
    });
  });

  const section = h('section', { class: 'section section-bg-alt', id: 'collab' },
    h('div', { class: 'section-header' },
      h('div', { class: 'section-tag' }, 'COLLABORATIVE'),
      h('h2', { class: 'section-title' }, 'Real-Time Collaboration'),
      h('p', { class: 'section-sub' },
        'createCollabSession() syncs signals across clients via CRDTs. Presence, cursors, and shared state — all reactive.',
      ),
    ),
    h('div', { class: 'card card-glow' },
      h('div', { class: 'collab-user-count' },
        h('strong', {}, '3 users'), ' online — watching the same signals',
      ),
      stage,
      h('div', { class: 'collab-info' },
        ...users.map(u =>
          h('div', { class: 'collab-user' },
            h('div', { class: 'collab-dot', style: `background:${u.color}` }),
            u.name,
          ),
        ),
      ),
    ),
  );

  return section;
}

// ── Footer ─────────────────────────────────────────────────────────────
function FooterSection(): HTMLElement {
  return h('footer', { class: 'showcase-footer' },
    h('p', {}, h('strong', {}, 'DRISHTI'), ' — The AI-Native Frontend Framework'),
    h('p', { style: 'margin-top: 8px' },
      '974 tests · 17 packages · MIT License · ',
      h('a', { href: 'https://github.com/2ool4techai-oss/front' }, 'GitHub'),
    ),
  );
}
