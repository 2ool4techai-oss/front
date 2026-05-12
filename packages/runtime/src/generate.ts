import { signal, computed, effect } from './signal.js';
import { h } from './renderer.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface GenerateOptions {
  apiKey?: string;
  model?: string;
  stream?: boolean;
}

export interface GenerateResult {
  code: string;
  component: () => HTMLElement;
  signals: string[];
  description: string;
}

// ── Prompt builder ─────────────────────────────────────────────────────

function buildPrompt(description: string): string {
  return `You are generating a DRISHTI reactive UI component.
DRISHTI API (already imported, do NOT re-import):
  signal(initial)      — creates a reactive signal. Call it as a function to read, .set(v) to write.
  computed(() => expr) — derived reactive value
  effect(() => {})     — runs side-effects when signals change
  h(tag, attrs, ...children) — creates an HTMLElement. attrs support reactive functions, event handlers (onClick, onInput…)

Rules:
- Return a function named "component" that takes no args and returns an HTMLElement
- Declare all signal names as an array named "signalNames" (string[])
- Keep code concise and self-contained

Description: "${description}"

Respond ONLY with a JSON object:
{
  "code": "<the full JS function body — just the code, no markdown fences>",
  "signals": ["<signal name>", ...]
}`;
}

// ── Async generate (uses API when key provided, else falls back) ───────

export async function generate(
  description: string,
  opts?: GenerateOptions,
): Promise<GenerateResult> {
  // If no API key, fall back to sync pattern matching
  if (!opts?.apiKey) {
    return generateSync(description);
  }

  const model = opts.model ?? 'claude-3-haiku-20240307';
  const url = 'https://api.anthropic.com/v1/messages';

  let rawBody = '';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt(description) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    rawBody = data.content?.[0]?.text ?? '';
  } catch {
    // Network failure or bad response — fall back to sync
    return generateSync(description);
  }

  // Parse JSON from LLM response
  let parsed: { code?: string; signals?: string[] } = {};
  try {
    // Try direct parse first, then extract from markdown fences
    const jsonMatch = rawBody.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]) as { code?: string; signals?: string[] };
    }
  } catch {
    return generateSync(description);
  }

  const code = parsed.code ?? '';
  const signals = parsed.signals ?? [];

  if (!code) return generateSync(description);

  const component = buildComponentFromCode(code);
  return { code, component, signals, description };
}

// ── Sync generate — pattern-matched templates ──────────────────────────

export function generateSync(description: string): GenerateResult {
  const lower = description.toLowerCase();

  // counter
  if (/counter|count/.test(lower)) {
    return counterTemplate(description);
  }

  // todo / task list
  if (/todo|task list|checklist/.test(lower)) {
    return todoTemplate(description);
  }

  // form with name/email or generic form
  if (/form/.test(lower) || /name.*email|email.*name/.test(lower)) {
    return formTemplate(description, lower);
  }

  // toggle / switch
  if (/toggle|switch|on.?off/.test(lower)) {
    return toggleTemplate(description);
  }

  // input / text field
  if (/input|text\s?field|text\s?box/.test(lower)) {
    return inputTemplate(description);
  }

  // accordion / expandable
  if (/accordion|collaps|expand/.test(lower)) {
    return accordionTemplate(description);
  }

  // slider / range
  if (/slider|range/.test(lower)) {
    return sliderTemplate(description);
  }

  // Default: generic card component
  return genericTemplate(description);
}

// ── Template implementations ───────────────────────────────────────────

function counterTemplate(description: string): GenerateResult {
  const code = `
    const count = signal(0);
    const container = h('div', { style: { display:'flex', alignItems:'center', gap:'12px', fontFamily:'system-ui,sans-serif', padding:'16px' } },
      h('button', { onClick: () => count.set(count() - 1), style: { padding:'6px 14px', cursor:'pointer', borderRadius:'6px', border:'1px solid #ccc', background:'#f1f5f9', fontSize:'18px' } }, '-'),
      h('span', { style: { fontSize:'24px', fontWeight:'bold', minWidth:'48px', textAlign:'center' } }, () => String(count())),
      h('button', { onClick: () => count.set(count() + 1), style: { padding:'6px 14px', cursor:'pointer', borderRadius:'6px', border:'1px solid #ccc', background:'#f1f5f9', fontSize:'18px' } }, '+')
    );
    return container;
  `;
  const component = () => {
    const count = signal(0);
    return h('div',
      { style: { display:'flex', alignItems:'center', gap:'12px', fontFamily:'system-ui,sans-serif', padding:'16px' } },
      h('button', { onClick: () => count.set(count() - 1), style: { padding:'6px 14px', cursor:'pointer', borderRadius:'6px', border:'1px solid #ccc', background:'#f1f5f9', fontSize:'18px' } }, '-'),
      h('span', { style: { fontSize:'24px', fontWeight:'bold', minWidth:'48px', textAlign:'center' } }, () => String(count())),
      h('button', { onClick: () => count.set(count() + 1), style: { padding:'6px 14px', cursor:'pointer', borderRadius:'6px', border:'1px solid #ccc', background:'#f1f5f9', fontSize:'18px' } }, '+'),
    );
  };
  return { code, component, signals: ['count'], description };
}

function todoTemplate(description: string): GenerateResult {
  const code = `
    const items = signal([]);
    const input = signal('');
    const addItem = () => {
      const v = input().trim();
      if (!v) return;
      items.set([...items(), { id: Date.now(), text: v, done: false }]);
      input.set('');
    };
    // ... (todo implementation)
    return container;
  `;
  const component = () => {
    const items = signal<Array<{ id: number; text: string; done: boolean }>>([]);
    const draft = signal('');

    const addItem = () => {
      const v = draft().trim();
      if (!v) return;
      items.set([...items(), { id: Date.now(), text: v, done: false }]);
      draft.set('');
    };

    const toggle = (id: number) => {
      items.set(items().map(i => i.id === id ? { ...i, done: !i.done } : i));
    };

    const listEl = h('ul', { style: { listStyle:'none', padding:'0', margin:'8px 0', maxHeight:'200px', overflowY:'auto' } });

    effect(() => {
      listEl.innerHTML = '';
      for (const item of items()) {
        const li = h('li',
          { style: { display:'flex', alignItems:'center', gap:'8px', padding:'6px 0', borderBottom:'1px solid #f1f5f9' } },
          h('input', { type:'checkbox', checked: item.done, onChange: () => toggle(item.id), style: { cursor:'pointer' } }),
          h('span', { style: { textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#94a3b8' : 'inherit', flex:'1' } }, item.text),
        );
        listEl.appendChild(li);
      }
    });

    const inputEl = document.createElement('input');
    inputEl.placeholder = 'Add a task…';
    inputEl.style.cssText = 'flex:1;padding:8px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px';
    inputEl.addEventListener('input', () => draft.set(inputEl.value));
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addItem(); inputEl.value = ''; } });

    return h('div',
      { style: { fontFamily:'system-ui,sans-serif', padding:'16px', maxWidth:'320px', border:'1px solid #e2e8f0', borderRadius:'10px' } },
      h('h3', { style: { margin:'0 0 12px', fontSize:'16px', fontWeight:'600' } }, 'Tasks'),
      h('div', { style: { display:'flex', gap:'8px', marginBottom:'8px' } },
        inputEl,
        h('button', { onClick: () => { addItem(); inputEl.value = ''; }, style: { padding:'8px 16px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'500' } }, 'Add'),
      ),
      listEl,
      h('p', { style: { margin:'8px 0 0', fontSize:'12px', color:'#94a3b8' } }, () => `${items().filter(i => !i.done).length} remaining`),
    );
  };
  return { code, component, signals: ['items', 'draft'], description };
}

function formTemplate(description: string, lower: string): GenerateResult {
  // Determine fields from description
  const hasName = /name/.test(lower);
  const hasEmail = /email/.test(lower);
  const hasPhone = /phone/.test(lower);
  const hasMessage = /message|comment/.test(lower);

  const code = `// form component`;
  const component = () => {
    const fields: Record<string, ReturnType<typeof signal<string>>> = {};
    const errors: Record<string, ReturnType<typeof signal<string>>> = {};
    const submitted = signal(false);

    const fieldDefs: Array<{ name: string; type: string; label: string; required?: boolean }> = [];
    if (hasName) fieldDefs.push({ name: 'name', type: 'text', label: 'Name', required: true });
    if (hasEmail) fieldDefs.push({ name: 'email', type: 'email', label: 'Email', required: true });
    if (hasPhone) fieldDefs.push({ name: 'phone', type: 'tel', label: 'Phone' });
    if (hasMessage) fieldDefs.push({ name: 'message', type: 'textarea', label: 'Message' });
    if (fieldDefs.length === 0) {
      fieldDefs.push({ name: 'name', type: 'text', label: 'Name', required: true });
      fieldDefs.push({ name: 'email', type: 'email', label: 'Email', required: true });
    }

    for (const f of fieldDefs) {
      fields[f.name] = signal('');
      errors[f.name] = signal('');
    }

    const fieldEls = fieldDefs.map(f => {
      const inp = document.createElement(f.type === 'textarea' ? 'textarea' : 'input') as HTMLInputElement;
      if (f.type !== 'textarea') inp.type = f.type;
      inp.placeholder = f.label;
      inp.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;box-sizing:border-box;font-family:inherit';
      inp.addEventListener('input', () => { fields[f.name]!.set(inp.value); errors[f.name]!.set(''); });
      const errSpan = h('span', { style: { color:'#ef4444', fontSize:'12px', minHeight:'16px', display:'block' } }, () => errors[f.name]!());
      return h('div', { style: { display:'flex', flexDirection:'column', gap:'4px' } },
        h('label', { style: { fontSize:'13px', fontWeight:'500', color:'#374151' } }, f.label + (f.required ? ' *' : '')),
        inp,
        errSpan,
      );
    });

    const validate = () => {
      let ok = true;
      for (const f of fieldDefs) {
        if (f.required && !fields[f.name]!().trim()) {
          errors[f.name]!.set(`${f.label} is required`);
          ok = false;
        } else if (f.type === 'email' && fields[f.name]!() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields[f.name]!())) {
          errors[f.name]!.set('Invalid email address');
          ok = false;
        }
      }
      return ok;
    };

    return h('form',
      {
        onSubmit: (e: Event) => { e.preventDefault(); if (validate()) submitted.set(true); },
        style: { fontFamily:'system-ui,sans-serif', padding:'20px', maxWidth:'360px', border:'1px solid #e2e8f0', borderRadius:'10px', display:'flex', flexDirection:'column', gap:'14px' },
      },
      h('h3', { style: { margin:'0 0 4px', fontSize:'16px', fontWeight:'600' } }, 'Form'),
      ...fieldEls,
      h('button', { type:'submit', style: { padding:'10px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'14px' } }, 'Submit'),
      h('p', { style: { margin:'0', fontSize:'13px', color:'#22c55e', minHeight:'16px' } }, () => submitted() ? 'Submitted successfully!' : ''),
    );
  };
  return { code, component, signals: ['fields', 'errors', 'submitted'], description };
}

function toggleTemplate(description: string): GenerateResult {
  const code = `const on = signal(false);`;
  const component = () => {
    const on = signal(false);
    const knob = h('div', { style: { width:'20px', height:'20px', borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.3)', transition:'transform .2s' } });
    const track = h('div',
      {
        onClick: () => on.set(!on()),
        style: { width:'44px', height:'24px', borderRadius:'12px', cursor:'pointer', display:'flex', alignItems:'center', padding:'2px', transition:'background .2s', userSelect:'none' },
      },
      knob,
    );
    effect(() => {
      track.style.background = on() ? '#3b82f6' : '#cbd5e1';
      knob.style.transform = on() ? 'translateX(20px)' : 'translateX(0)';
    });
    return h('div',
      { style: { display:'flex', alignItems:'center', gap:'12px', fontFamily:'system-ui,sans-serif', padding:'16px' } },
      track,
      h('span', { style: { fontSize:'14px', color:'#374151' } }, () => on() ? 'On' : 'Off'),
    );
  };
  return { code, component, signals: ['on'], description };
}

function inputTemplate(description: string): GenerateResult {
  const code = `const value = signal('');`;
  const component = () => {
    const value = signal('');
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'Type something…';
    inputEl.style.cssText = 'padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;font-family:inherit;width:200px';
    inputEl.addEventListener('input', () => value.set(inputEl.value));
    return h('div',
      { style: { display:'flex', flexDirection:'column', gap:'8px', fontFamily:'system-ui,sans-serif', padding:'16px' } },
      inputEl,
      h('p', { style: { margin:'0', fontSize:'13px', color:'#64748b' } }, () => value() ? `You typed: ${value()}` : 'Start typing above'),
    );
  };
  return { code, component, signals: ['value'], description };
}

function accordionTemplate(description: string): GenerateResult {
  const code = `const open = signal(false);`;
  const component = () => {
    const open = signal(false);
    const body = h('div',
      { style: { padding:'12px 16px', borderTop:'1px solid #e2e8f0', fontSize:'14px', color:'#374151', overflow:'hidden' } },
      'This is the accordion content. Click the header to collapse.',
    );
    effect(() => { body.style.display = open() ? 'block' : 'none'; });
    return h('div',
      { style: { fontFamily:'system-ui,sans-serif', border:'1px solid #e2e8f0', borderRadius:'8px', maxWidth:'320px' } },
      h('button',
        {
          onClick: () => open.set(!open()),
          style: { width:'100%', padding:'12px 16px', background:'none', border:'none', textAlign:'left', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'14px', fontWeight:'600' },
        },
        h('span', {}, 'Section'),
        h('span', { style: { transition:'transform .2s' } }, () => open() ? '▲' : '▼'),
      ),
      body,
    );
  };
  return { code, component, signals: ['open'], description };
}

function sliderTemplate(description: string): GenerateResult {
  const code = `const value = signal(50);`;
  const component = () => {
    const value = signal(50);
    const sliderEl = document.createElement('input');
    sliderEl.type = 'range';
    sliderEl.min = '0';
    sliderEl.max = '100';
    sliderEl.value = '50';
    sliderEl.style.cssText = 'width:200px;cursor:pointer';
    sliderEl.addEventListener('input', () => value.set(Number(sliderEl.value)));
    return h('div',
      { style: { display:'flex', flexDirection:'column', gap:'8px', fontFamily:'system-ui,sans-serif', padding:'16px' } },
      h('div', { style: { display:'flex', justifyContent:'space-between', fontSize:'13px', color:'#374151' } },
        h('span', {}, 'Value'),
        h('span', { style: { fontWeight:'600' } }, () => String(value())),
      ),
      sliderEl,
    );
  };
  return { code, component, signals: ['value'], description };
}

function genericTemplate(description: string): GenerateResult {
  const code = `// generic card component`;
  const component = () => {
    return h('div',
      { style: { fontFamily:'system-ui,sans-serif', padding:'20px', maxWidth:'320px', border:'1px solid #e2e8f0', borderRadius:'10px', display:'flex', flexDirection:'column', gap:'8px' } },
      h('h3', { style: { margin:'0', fontSize:'16px', fontWeight:'600', color:'#1e293b' } }, description.slice(0, 60)),
      h('p', { style: { margin:'0', fontSize:'14px', color:'#64748b' } }, `Generated component for: "${description}"`),
    );
  };
  return { code, component, signals: [], description };
}

// ── Utility: build a component function from a raw code string ─────────

function buildComponentFromCode(code: string): () => HTMLElement {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const factory = new Function('signal', 'computed', 'effect', 'h', `"use strict"; return function component() { ${code} }`) as (
      signal: typeof import('./signal.js').signal,
      computed: typeof import('./signal.js').computed,
      effect: typeof import('./signal.js').effect,
      h: typeof import('./renderer.js').h,
    ) => () => HTMLElement;
    return factory(signal, computed, effect, h);
  } catch {
    return () => h('div', { style: { color:'#ef4444', padding:'8px', fontFamily:'system-ui' } }, 'Component generation failed');
  }
}
