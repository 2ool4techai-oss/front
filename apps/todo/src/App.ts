import { signal, computed, h, each, show } from '@nexoraaidrishti/runtime';

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
        return h('div', { class: () => `todo-item${todoSig().completed ? ' done' : ''}` },
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
      h('span', { class: 'count' }, () => `${remaining()} item${remaining() === 1 ? '' : 's'} left`),
      h('div', { class: 'filters' },
        ...(['all', 'active', 'completed'] as const).map(f =>
          h('button', {
            class:   () => `filter-btn${filter() === f ? ' active' : ''}`,
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
