// ── scaffold() — programmatic API for create-drishti-app ──────────────────────

export interface ScaffoldOptions {
  name:        string;
  template?:   'minimal' | 'todo' | 'dashboard'; // default 'minimal'
  typescript?: boolean;                           // default true
}

export interface ScaffoldResult {
  files:        Record<string, string>; // filename → content
  instructions: string[];               // steps to print after scaffold
}

export function scaffold(opts: ScaffoldOptions): ScaffoldResult {
  const { name, template = 'minimal' } = opts;

  const files: Record<string, string> = {
    'index.html':     indexHtml(name),
    'vite.config.ts': viteConfig(),
    'package.json':   packageJson(name),
    'tsconfig.json':  tsConfig(),
    'src/main.ts':    mainTs(),
    'src/App.ts':     template === 'todo' ? todoAppTs() : minimalAppTs(),
    'src/app.css':    appCss(),
  };

  const instructions: string[] = [
    `cd ${name}`,
    'pnpm install',
    'pnpm dev',
    'Open http://localhost:5173',
  ];

  return { files, instructions };
}

// ── Template generators ────────────────────────────────────────────────────────

function indexHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="/src/app.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`;
}

function viteConfig(): string {
  return `import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@drishti/runtime': '/node_modules/@drishti/runtime/dist/index.js' }
  }
});
`;
}

function packageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev:     'vite',
        build:   'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        '@drishti/runtime':    '^0.1.0',
        '@drishti/components': '^0.1.0',
      },
      devDependencies: {
        typescript: '^5.4.5',
        vite:       '^5.2.0',
      },
    },
    null,
    2,
  ) + '\n';
}

function tsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target:           'ES2022',
        module:           'ESNext',
        moduleResolution: 'bundler',
        strict:           true,
        noUnusedLocals:      true,
        noUnusedParameters:  true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      },
      include: ['src'],
    },
    null,
    2,
  ) + '\n';
}

function mainTs(): string {
  return `import { mountApp } from '@drishti/runtime';
import { App } from './App.js';

mountApp(App, document.getElementById('app')!);
`;
}

function minimalAppTs(): string {
  return `import { signal, h } from '@drishti/runtime';
export function App(container: HTMLElement): () => void {
  const count = signal(0);
  const el = h('div', { class: 'app' },
    h('h1', {}, 'Hello from DRISHTI'),
    h('p', {}, () => \`Count: \${count()}\`),
    h('button', { onclick: () => count.set(count() + 1) }, 'Increment'),
  );
  container.appendChild(el);
  return () => container.removeChild(el);
}
`;
}

function todoAppTs(): string {
  return `import { signal, computed, h, each, show } from '@drishti/runtime';

interface Todo {
  id:        number;
  text:      string;
  completed: boolean;
}

export function App(container: HTMLElement): () => void {
  const todos    = signal<Todo[]>([]);
  const input    = signal('');
  const filter   = signal<'all' | 'active' | 'completed'>('all');
  let   nextId   = 1;

  const filtered = computed(() => {
    const f = filter();
    const t = todos();
    if (f === 'active')    return t.filter(td => !td.completed);
    if (f === 'completed') return t.filter(td =>  td.completed);
    return t;
  });

  const remaining    = computed(() => todos().filter(td => !td.completed).length);
  const hasCompleted = computed(() => todos().some(td => td.completed));

  function addTodo(): void {
    const text = input().trim();
    if (!text) return;
    todos.set([...todos(), { id: nextId++, text, completed: false }]);
    input.set('');
  }

  function toggleTodo(id: number): void {
    todos.set(todos().map(td => td.id === id ? { ...td, completed: !td.completed } : td));
  }

  function removeTodo(id: number): void {
    todos.set(todos().filter(td => td.id !== id));
  }

  function clearCompleted(): void {
    todos.set(todos().filter(td => !td.completed));
  }

  // Build DOM
  const app = h('div', { class: 'app' },
    h('h1', {}, 'todos'),
    h('div', { class: 'input-row' },
      h('input', {
        class:       'todo-input',
        type:        'text',
        placeholder: 'What needs to be done?',
        oninput:   (e: Event) => input.set((e.target as HTMLInputElement).value),
        onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') addTodo(); },
      }),
      h('button', { class: 'add-btn', onclick: addTodo }, 'Add'),
    ),
    each(
      filtered,
      (todo, i) => String(i),
      (todoSig) => {
        const todo = todoSig();
        return h('div', { class: () => \`todo-item\${todoSig().completed ? ' done' : ''}\` },
          h('input', {
            type:     'checkbox',
            checked:  todo.completed,
            onchange: () => toggleTodo(todo.id),
          }),
          h('span', { class: 'todo-text' }, todo.text),
          h('button', { class: 'del-btn', onclick: () => removeTodo(todo.id) }, '×'),
        );
      },
    ),
    h('div', { class: 'footer' },
      h('span', { class: 'count' }, () => \`\${remaining()} item\${remaining() === 1 ? '' : 's'} left\`),
      h('div', { class: 'filters' },
        ...(['all', 'active', 'completed'] as const).map(f =>
          h('button', {
            class:   () => \`filter-btn\${filter() === f ? ' active' : ''}\`,
            onclick: () => filter.set(f),
          }, f),
        ),
      ),
      show(
        hasCompleted,
        () => h('button', { class: 'clear-btn', onclick: clearCompleted }, 'Clear completed'),
      ),
    ),
  );

  container.appendChild(app);
  return () => { container.removeChild(app); };
}
`;
}

function appCss(): string {
  return `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #0d0d1a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 40px 20px; }
.app { width: 100%; max-width: 520px; }
h1 { font-size: 2.5rem; font-weight: 800; color: #3b82f6; text-align: center; margin-bottom: 24px; }
.input-row { display: flex; gap: 8px; margin-bottom: 16px; }
.todo-input { flex: 1; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #e2e8f0; font-size: 1rem; }
.todo-input:focus { outline: none; border-color: #3b82f6; }
.add-btn { padding: 10px 18px; border-radius: 8px; border: none; background: #3b82f6; color: #fff; font-weight: 600; cursor: pointer; }
.add-btn:hover { background: #2563eb; }
.todo-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,.04); margin-bottom: 6px; border: 1px solid rgba(255,255,255,.06); }
.todo-item.done .todo-text { text-decoration: line-through; color: #64748b; }
.todo-text { flex: 1; font-size: .95rem; }
.del-btn { background: none; border: none; color: #64748b; cursor: pointer; font-size: 1.2rem; line-height: 1; padding: 2px 6px; border-radius: 4px; }
.del-btn:hover { background: rgba(255,255,255,.08); color: #f87171; }
.footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 4px; font-size: .85rem; color: #64748b; flex-wrap: wrap; gap: 8px; }
.filters { display: flex; gap: 4px; }
.filter-btn { background: none; border: 1px solid transparent; border-radius: 4px; padding: 3px 10px; color: #64748b; cursor: pointer; font-size: .85rem; }
.filter-btn:hover { border-color: rgba(255,255,255,.12); }
.filter-btn.active { border-color: #3b82f6; color: #3b82f6; }
.clear-btn { background: none; border: none; color: #64748b; cursor: pointer; font-size: .85rem; }
.clear-btn:hover { color: #f87171; }
`;
}
