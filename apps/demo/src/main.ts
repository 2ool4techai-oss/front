import { loadGenome, EmotionProcessor, signal, effect, h, computed } from '@drishti/runtime';
import { MetricCard, SentientForm, ReactiveTable, EmotionBadge, HealingCard } from '@drishti/components';
import type { GenomeConfig } from '@drishti/runtime';
import type { EmotionState } from '@drishti/runtime';

const genome: GenomeConfig = {
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
};

loadGenome(genome);

const app = document.getElementById('app')!;

function buildApp(): void {
  const emotionState = signal<EmotionState>('calm');
  let processor: EmotionProcessor | null = null;

  const layout = h('div', {
    style: {
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '0 24px 64px',
    },
  });

  layout.appendChild(buildHeader(emotionState));

  const mainSection = h('main', { style: { display: 'flex', flexDirection: 'column', gap: '48px' } });
  mainSection.appendChild(buildEmotionSection(emotionState));
  mainSection.appendChild(buildMetricsSection(emotionState));
  mainSection.appendChild(buildHealingSection());
  mainSection.appendChild(buildTableSection());
  mainSection.appendChild(buildFormSection(emotionState));
  mainSection.appendChild(buildCompilerSection());

  layout.appendChild(mainSection);
  app.appendChild(layout);

  // Start emotion tracking after first paint — scoped to layout container only
  requestAnimationFrame(() => {
    processor = new EmotionProcessor(layout);
    processor.state.subscribe(state => emotionState.set(state));
  });
}

function buildHeader(emotion: ReturnType<typeof signal<EmotionState>>): HTMLElement {
  const header = h('header', {
    style: {
      padding: '32px 0 40px',
      borderBottom: '1px solid #e2e8f0',
      marginBottom: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '16px',
    },
  });

  const brand = h('div');
  const logo = h('h1', {
    style: {
      fontSize: '1.75rem',
      fontWeight: '800',
      color: 'var(--dr-color-secondary)',
      letterSpacing: '-0.03em',
    },
  });
  logo.innerHTML = '<span style="color:var(--dr-color-primary)">DRISHTI</span> <span style="font-weight:300;font-size:1.1rem;color:#64748b">v0.1</span>';

  const tagline = h('p', {
    style: { color: '#64748b', fontSize: '0.875rem', marginTop: '4px' },
  });
  tagline.textContent = 'AI-Native Frontend Runtime · Sees · Feels · Heals · Protects';

  brand.appendChild(logo);
  brand.appendChild(tagline);

  const badge = EmotionBadge({ emotion: () => emotion(), size: 'lg' });

  header.appendChild(brand);
  header.appendChild(badge);
  return header;
}

function sectionHeader(title: string, desc: string): HTMLElement {
  const wrap = h('div', { style: { marginBottom: '20px' } });
  const h2 = document.createElement('h2');
  h2.textContent = title;
  h2.style.cssText = 'font-size:1.25rem;font-weight:700;color:#0f172a;margin-bottom:4px;';
  const p = document.createElement('p');
  p.textContent = desc;
  p.style.cssText = 'color:#64748b;font-size:.875rem;';
  wrap.appendChild(h2);
  wrap.appendChild(p);
  return wrap;
}

function section(children: HTMLElement[]): HTMLElement {
  const s = h('section');
  for (const c of children) s.appendChild(c);
  return s;
}

function buildEmotionSection(emotionState: ReturnType<typeof signal<EmotionState>>): HTMLElement {
  const states: EmotionState[] = ['calm', 'engaged', 'frustrated', 'confused', 'celebrating'];

  const header = sectionHeader(
    '1 · Emotion Intelligence',
    'Move your mouse fast (frustrated), pause hesitantly (confused), click steadily (engaged). The badge updates live.',
  );

  const grid = h('div', {
    style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' },
  });

  for (const state of states) {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' } });

    const badge = EmotionBadge({
      emotion: () => state,
      showLabel: true,
    });

    const trigger = h('button', {
      style: {
        padding: '6px 14px',
        fontSize: '.75rem',
        border: '1.5px solid #e2e8f0',
        borderRadius: '6px',
        cursor: 'pointer',
        background: '#fff',
        color: '#374151',
        fontFamily: 'inherit',
        transition: 'all 200ms',
      },
    });
    trigger.textContent = `Simulate`;
    trigger.addEventListener('click', () => emotionState.set(state));
    trigger.addEventListener('mouseenter', () => {
      trigger.style.borderColor = 'var(--dr-color-primary)';
      trigger.style.color = 'var(--dr-color-primary)';
    });
    trigger.addEventListener('mouseleave', () => {
      trigger.style.borderColor = '#e2e8f0';
      trigger.style.color = '#374151';
    });

    wrap.appendChild(badge);
    wrap.appendChild(trigger);
    grid.appendChild(wrap);
  }

  const liveWrap = h('div', {
    style: {
      marginTop: '16px',
      padding: '12px 16px',
      background: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '.875rem',
      color: '#374151',
    },
  });

  const liveLabel = document.createElement('span');
  liveLabel.textContent = 'Live detection: ';
  liveLabel.style.cssText = 'font-weight:500;';

  const liveBadge = EmotionBadge({ emotion: () => emotionState(), size: 'md', showLabel: true });
  liveWrap.appendChild(liveLabel);
  liveWrap.appendChild(liveBadge);

  return section([header, grid, liveWrap]);
}

function buildMetricsSection(emotionState: ReturnType<typeof signal<EmotionState>>): HTMLElement {
  const header = sectionHeader(
    '2 · Intelligence Units — MetricCard',
    'Signal-reactive metrics. Trend triggers a shimmer animation. Frustrated emotion shifts colors.',
  );

  const revenue = signal(142830);
  const revenueT = signal(8.4);
  const users = signal(24817);
  const usersT = signal(-2.1);
  const nps = signal(72);
  const npsT = signal(0);

  const grid = h('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  });

  grid.appendChild(MetricCard({
    label: 'Monthly Revenue',
    value: () => revenue(),
    unit: '₹',
    trend: () => revenueT(),
    format: v => `${(Number(v) / 1000).toFixed(1)}K`,
    emotion: () => emotionState(),
  }));

  grid.appendChild(MetricCard({
    label: 'Active Users',
    value: () => users(),
    trend: () => usersT(),
    format: v => Number(v).toLocaleString(),
    emotion: () => emotionState(),
  }));

  grid.appendChild(MetricCard({
    label: 'NPS Score',
    value: () => nps(),
    trend: () => npsT(),
    emotion: () => emotionState(),
  }));

  const controls = h('div', {
    style: { marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' },
  });

  const makeBtn = (label: string, cb: () => void) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'padding:6px 14px;background:var(--dr-color-primary);color:#fff;border:none;border-radius:6px;font-size:.8rem;cursor:pointer;font-family:inherit;transition:opacity 150ms;';
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
    btn.addEventListener('click', cb);
    return btn;
  };

  controls.appendChild(makeBtn('Revenue +10%', () => {
    revenue.set(Math.round(revenue.peek() * 1.1));
    revenueT.set(+(revenueT.peek() + 2).toFixed(1));
  }));
  controls.appendChild(makeBtn('Revenue −5%', () => {
    revenue.set(Math.round(revenue.peek() * 0.95));
    revenueT.set(+(-3.2).toFixed(1));
  }));
  controls.appendChild(makeBtn('Add 1K Users', () => {
    users.set(users.peek() + 1000);
    usersT.set(+(usersT.peek() + 1.5).toFixed(1));
  }));

  return section([header, grid, controls]);
}

function buildHealingSection(): HTMLElement {
  const header = sectionHeader(
    '3 · Self-Healing Components',
    'Cards that automatically retry failed loads. Watch the status badge cycle: Loading → Healing → Ready.',
  );

  const grid = h('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  });

  let failCount = 0;
  grid.appendChild(HealingCard({
    title: 'Unreliable Data Source',
    heal: { mode: 'retry', retries: 3 },
    load: async () => {
      await new Promise(r => setTimeout(r, 600));
      failCount++;
      if (failCount < 3) throw new Error('Network error (simulated)');
      failCount = 0;
      return 'Data loaded successfully after retries! Self-healing in action.';
    },
  }));

  grid.appendChild(HealingCard({
    title: 'Stable Data Source',
    heal: { mode: 'auto' },
    load: async () => {
      await new Promise(r => setTimeout(r, 400));
      const el = h('div');
      el.innerHTML = '<p style="color:#374151;margin:0;line-height:1.6">✓ Loaded instantly with no errors. <br><small style="color:#64748b">This component will auto-recover if something breaks later.</small></p>';
      return el;
    },
  }));

  grid.appendChild(HealingCard({
    title: 'Always Fails',
    heal: { mode: 'retry', retries: 2 },
    load: async () => {
      await new Promise(r => setTimeout(r, 300));
      throw new Error('Permanent failure — shows graceful fallback UI');
    },
  }));

  return section([header, grid]);
}

interface UserRow extends Record<string, unknown> {
  id: number;
  name: string;
  email: string;
  plan: string;
  mrr: number;
  status: string;
}

function buildTableSection(): HTMLElement {
  const header = sectionHeader(
    '4 · Reactive Data Table',
    'Fine-grained signals: only changed cells update. Search, sort, paginate — no framework overhead.',
  );

  const rows: UserRow[] = Array.from({ length: 47 }, (_, i) => ({
    id: i + 1,
    name: ['Priya Sharma','Arjun Mehta','Naveen Kumar','Anita Patel','Rahul Singh','Sneha Gupta','Vikram Das','Pooja Nair','Amit Verma','Kavya Reddy'][i % 10]!,
    email: `user${i + 1}@example.com`,
    plan: ['Starter','Growth','Enterprise'][i % 3]!,
    mrr: [999, 4999, 24999][i % 3]!,
    status: i % 7 === 0 ? 'Churned' : 'Active',
  }));

  const data = signal(rows);

  const table = ReactiveTable<UserRow>({
    data: () => data(),
    searchable: true,
    pageSize: 8,
    columns: [
      { key: 'name', label: 'Name', width: '180px' },
      { key: 'email', label: 'Email', width: '220px' },
      { key: 'plan', label: 'Plan', width: '100px' },
      {
        key: 'mrr',
        label: 'MRR (₹)',
        width: '120px',
        format: v => `₹${Number(v).toLocaleString()}`,
      },
      {
        key: 'status',
        label: 'Status',
        width: '100px',
        format: v => v === 'Active' ? '● Active' : '○ Churned',
        sortable: false,
      },
    ],
    onRowClick: (row) => {
      const msg = `Clicked: ${row.name} (${row.plan})`;
      const toast = buildToast(msg);
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },
  });

  return section([header, table]);
}

function buildFormSection(emotionState: ReturnType<typeof signal<EmotionState>>): HTMLElement {
  const header = sectionHeader(
    '5 · Sentient Form',
    'Self-validates, zero unsafe input reaches the DOM. Emotion-aware: confused/frustrated mode makes labels larger.',
  );

  const wrap = h('div', {
    style: {
      maxWidth: '480px',
      background: '#fff',
      padding: '24px',
      borderRadius: 'var(--dr-border-radius)',
      boxShadow: 'var(--dr-shadow)',
    },
  });

  wrap.appendChild(SentientForm({
    fields: [
      { name: 'name', label: 'Full Name', required: true, placeholder: 'Naveen Kumar' },
      {
        name: 'email',
        label: 'Email Address',
        type: 'email',
        required: true,
        placeholder: 'naveen@example.com',
        validate: (v) => v.includes('@') ? null : 'Enter a valid email address',
      },
      {
        name: 'message',
        label: 'Message',
        type: 'textarea',
        placeholder: 'Tell us about your use case…',
        validate: (v) => v.length > 10 ? null : 'Message must be at least 10 characters',
      },
    ],
    submitLabel: 'Send Message',
    emotion: () => emotionState(),
    onSubmit: async (data) => {
      await new Promise(r => setTimeout(r, 1000));
      console.info('[DRISHTI demo] Form submitted (sanitized):', data);
    },
  }));

  return section([header, wrap]);
}

function buildCompilerSection(): HTMLElement {
  const header = sectionHeader(
    '6 · DRISHTI Compiler — Live',
    'Write .dr syntax and see it compile to TypeScript in real time.',
  );

  const DEFAULT_DR = `surface: Dashboard
  intent: show revenue analytics
  secure: authenticated

  unit: RevenueCard
    data: connect(api.metrics, realtime)
    feel: celebrate if trending.positive
    feel: calm-alert if trending.negative
    heal: retry(3) then empty-state
    secure: role(manager)

  unit: UserTable
    data: connect(api.users)
    columns: [name, email, plan, mrr]
    heal: auto
    layout: grid(2)`;

  const container = h('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
    },
  });

  const panelStyle = 'border-radius:8px;overflow:hidden;box-shadow:var(--dr-shadow);';

  const inputPanel = h('div', { style: panelStyle });
  const inputHeader = h('div', { style: 'background:#1e1e2e;padding:10px 16px;display:flex;align-items:center;gap:8px;' });
  const dot = (c: string) => { const d = document.createElement('span'); d.style.cssText = `width:10px;height:10px;border-radius:50%;background:${c};display:inline-block;`; return d; };
  inputHeader.appendChild(dot('#ff5f57'));
  inputHeader.appendChild(dot('#febc2e'));
  inputHeader.appendChild(dot('#28c840'));
  const inputTitle = document.createElement('span');
  inputTitle.textContent = 'dashboard.dr';
  inputTitle.style.cssText = 'color:#a6b3cc;font-size:.75rem;margin-left:4px;font-family:monospace;';
  inputHeader.appendChild(inputTitle);

  const textarea = document.createElement('textarea');
  textarea.value = DEFAULT_DR;
  textarea.style.cssText = `
    width: 100%;
    min-height: 320px;
    padding: 16px;
    background: #1e1e2e;
    color: #cdd6f4;
    border: none;
    outline: none;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: .8rem;
    line-height: 1.6;
    resize: vertical;
    tab-size: 2;
  `;

  inputPanel.appendChild(inputHeader);
  inputPanel.appendChild(textarea);

  const outputPanel = h('div', { style: panelStyle });
  const outputHeader = h('div', { style: 'background:#0d1117;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;' });
  const outputTitle = document.createElement('span');
  outputTitle.textContent = 'Generated TypeScript';
  outputTitle.style.cssText = 'color:#8b949e;font-size:.75rem;font-family:monospace;';
  const compileTime = document.createElement('span');
  compileTime.style.cssText = 'color:#3fb950;font-size:.7rem;font-family:monospace;';
  outputHeader.appendChild(outputTitle);
  outputHeader.appendChild(compileTime);

  const output = document.createElement('pre');
  output.style.cssText = `
    width: 100%;
    min-height: 320px;
    padding: 16px;
    background: #0d1117;
    color: #e6edf3;
    border: none;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: .8rem;
    line-height: 1.6;
    overflow: auto;
    margin: 0;
  `;

  outputPanel.appendChild(outputHeader);
  outputPanel.appendChild(output);

  const errPanel = h('div', {
    style: 'display:none;background:#2d1b1e;border:1px solid #f85149;border-radius:6px;padding:10px 14px;color:#f85149;font-size:.8rem;font-family:monospace;margin-top:8px;white-space:pre-wrap;',
  });

  const recompile = () => {
    const t0 = performance.now();
    try {
      import('@drishti/compiler').then(({ compile }) => {
        const result = compile(textarea.value);
        const dt = (performance.now() - t0).toFixed(1);

        if (result.errors.length) {
          errPanel.style.display = 'block';
          errPanel.textContent = result.errors.join('\n');
          output.textContent = '';
        } else {
          errPanel.style.display = 'none';
          output.textContent = result.code;
          compileTime.textContent = `✓ ${dt}ms`;
        }
      });
    } catch (e) {
      errPanel.style.display = 'block';
      errPanel.textContent = String(e);
    }
  };

  let debounceTimer: ReturnType<typeof setTimeout>;
  textarea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(recompile, 300);
  });

  setTimeout(recompile, 100);

  container.appendChild(inputPanel);
  container.appendChild(outputPanel);

  return section([header, container, errPanel]);
}

function buildToast(msg: string): HTMLElement {
  const toast = h('div', {
    style: {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: 'var(--dr-color-secondary)',
      color: '#fff',
      padding: '10px 18px',
      borderRadius: '8px',
      fontSize: '.875rem',
      fontFamily: 'var(--dr-font-family)',
      boxShadow: '0 4px 16px rgba(0,0,0,.2)',
      zIndex: '9999',
      animation: 'dr-pulse 0.3s ease',
      maxWidth: '320px',
    },
  });
  toast.textContent = msg;
  return toast;
}

buildApp();
