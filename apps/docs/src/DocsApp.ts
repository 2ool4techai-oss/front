import { signal, computed, h } from '@nexoraaidrishti/runtime';

interface DocSection {
  id:      string;
  title:   string;
  content: () => HTMLElement;
}

export function DocsApp(container: HTMLElement): () => void {
  const activeSection = signal('getting-started');
  const menuOpen = signal(false);

  // ── Helpers ──────────────────────────────────────────────────────────

  function para(text: string): HTMLElement {
    return h('p', { class: 'doc-para' }, text);
  }

  function heading(text: string): HTMLElement {
    return h('h3', { class: 'doc-h3' }, text);
  }

  function codeBlock(code: string): HTMLElement {
    const block = h('div', { class: 'code-block' },
      h('pre', {}, h('code', {}, code)),
      h('button', {
        class: 'copy-btn',
        onclick: () => {
          void navigator.clipboard?.writeText(code);
          const btn = block.querySelector('.copy-btn') as HTMLElement;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        },
      }, 'Copy'),
    );
    return block;
  }

  function docSection(title: string, ...children: HTMLElement[]): HTMLElement {
    return h('div', { class: 'doc-content' },
      h('h2', { class: 'doc-h2' }, title),
      ...children,
    );
  }

  // ── Sections ─────────────────────────────────────────────────────────

  const sections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content: () => docSection('Getting Started',
        para('DRISHTI is an AI-native frontend framework built on fine-grained signals. Zero virtual DOM, maximum performance.'),
        codeBlock(`# Create a new app
npx create-drishti-app my-app
cd my-app
pnpm install
pnpm dev`),
        heading('Install manually'),
        codeBlock(`pnpm add @nexoraaidrishti/runtime @nexoraaidrishti/components`),
      ),
    },
    {
      id: 'signals',
      title: 'Signals',
      content: () => docSection('Signals',
        para('Signals are the core reactive primitive. They are fine-grained — only effects that read a signal re-run when it changes.'),
        codeBlock(`import { signal, computed, effect } from '@nexoraaidrishti/runtime';

const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => {
  console.log('count:', count(), 'doubled:', doubled());
});

count.set(5); // logs: count: 5 doubled: 10`),
        heading('Signal API'),
        codeBlock(`const sig = signal(initialValue);
sig()             // read value
sig.set(val)      // write value
sig.peek()        // read without tracking
sig.subscribe(fn) // subscribe to changes`),
      ),
    },
    {
      id: 'rendering',
      title: 'Rendering',
      content: () => docSection('Rendering',
        para('DRISHTI renders directly to the DOM — no virtual DOM diff. Reactive updates are surgical: only changed attributes/text nodes update.'),
        codeBlock(`import { h, signal, mountApp } from '@nexoraaidrishti/runtime';

function App(container) {
  const name = signal('World');

  const el = h('div', {},
    h('h1', {}, () => \`Hello, \${name()}!\`),
    h('input', {
      oninput: e => name.set(e.target.value),
      placeholder: 'Your name'
    }),
  );

  container.appendChild(el);
  return () => container.removeChild(el);
}

mountApp(App, document.getElementById('app'));`),
      ),
    },
    {
      id: 'state-machines',
      title: 'State Machines',
      content: () => docSection('State Machines',
        para('createMachine() provides XState-inspired state machines backed by signals. Entry/exit hooks, context mutations, history tracking.'),
        codeBlock(`import { createMachine } from '@nexoraaidrishti/runtime';

const machine = createMachine({
  initial: 'idle',
  context: { retries: 0 },
  states: {
    idle:    { on: { FETCH: 'loading' } },
    loading: {
      on: {
        SUCCESS: 'success',
        ERROR: { target: 'error', action: ctx => ({ retries: ctx.retries + 1 }) }
      }
    },
    success: { type: 'final' },
    error:   { on: { RETRY: 'loading' } },
  }
});

machine.send('FETCH');
console.log(machine.state()); // 'loading'`),
      ),
    },
    {
      id: 'time-travel',
      title: 'Time Travel',
      content: () => docSection('Time Travel Debugging',
        para('DRISHTI is the only frontend framework with built-in time-travel debugging. Every signal write is recorded — you can undo/redo the entire application state.'),
        codeBlock(`import { signal, enableTimeTravel } from '@nexoraaidrishti/runtime';

const tt = enableTimeTravel({ maxHistory: 100 });

const count = signal(0);
count.set(1);
count.set(2);
count.set(3);

tt.undo();     // count() === 2
tt.undo();     // count() === 1
tt.redo();     // count() === 2
tt.goto(0);    // back to initial state`),
      ),
    },
    {
      id: 'components',
      title: 'Components',
      content: () => docSection('UI Components',
        para('@nexoraaidrishti/components provides 30+ accessible, signal-native UI components. No React. No Vue. Pure DOM.'),
        codeBlock(`import { createModal, createToast, createSelect } from '@nexoraaidrishti/components';

// Modal
const modal = createModal({
  title: 'Confirm',
  content: 'Are you sure?',
  onClose: () => console.log('closed'),
});
modal.open();

// Toast
createToast({ message: 'Saved!', type: 'success', duration: 3000 });

// Select
const select = createSelect({
  options: [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ],
  onChange: val => console.log(val),
});`),
      ),
    },
    {
      id: 'a11y',
      title: 'Accessibility',
      content: () => docSection('Accessibility (WCAG 2.2)',
        para('@nexoraaidrishti/testing includes a built-in WCAG 2.2 audit engine with 18+ rules across A, AA, and AAA levels.'),
        codeBlock(`import { auditA11y, assertA11y } from '@nexoraaidrishti/testing';

// Audit any element
const report = auditA11y(document.getElementById('app'));
console.log(report.score);       // 0-100
console.log(report.violations);  // array of violations

// Throw on violations (great for CI)
assertA11y(document.getElementById('app'), {
  level: 'AA',
  ignore: ['skip-link'],
});`),
      ),
    },
  ];

  // ── Reactive state ────────────────────────────────────────────────────

  const currentSection = computed(() =>
    sections.find(s => s.id === activeSection()) ?? sections[0]!
  );

  // ── Sidebar nav items ─────────────────────────────────────────────────

  const sidebarItems = sections.map(s =>
    h('button', {
      class: () => `nav-item${activeSection() === s.id ? ' active' : ''}`,
      onclick: () => { activeSection.set(s.id); menuOpen.set(false); },
    }, s.title)
  );

  // ── App shell ─────────────────────────────────────────────────────────

  const appEl = h('div', { class: 'docs-app' },
    // Header
    h('header', { class: 'docs-header' },
      h('div', { class: 'header-inner' },
        h('div', { class: 'logo' },
          h('span', { class: 'logo-mark' }, 'DR'),
          h('span', { class: 'logo-text' }, 'DRISHTI'),
        ),
        h('nav', { class: 'header-nav' },
          h('a', { href: 'https://github.com/2ool4techai-oss/front', class: 'nav-link' }, 'GitHub'),
          h('span', { class: 'badge' }, 'v0.1.0'),
        ),
        h('button', {
          class: 'menu-toggle',
          onclick: () => menuOpen.set(!menuOpen()),
          'aria-label': 'Toggle menu',
        }, '☰'),
      ),
    ),
    // Body
    h('div', { class: 'docs-body' },
      // Sidebar
      h('aside', { class: () => `docs-sidebar${menuOpen() ? ' open' : ''}` },
        h('div', { class: 'sidebar-section' },
          h('p', { class: 'sidebar-label' }, 'Documentation'),
          ...sidebarItems,
        ),
      ),
      // Main
      h('main', { class: 'docs-main' },
        h('div', { class: 'docs-article' },
          h('div', { class: 'content-wrapper', id: 'doc-content' }),
        ),
      ),
    ),
  );

  // ── Mount & content updates ───────────────────────────────────────────

  container.appendChild(appEl);

  const contentWrapper = appEl.querySelector('#doc-content') as HTMLElement;

  function updateContent(): void {
    contentWrapper.innerHTML = '';
    contentWrapper.appendChild(currentSection().content());
  }

  // Initial render
  updateContent();

  // React to section changes
  const unsubscribe = activeSection.subscribe(() => updateContent());

  return () => {
    unsubscribe();
    container.removeChild(appEl);
  };
}
