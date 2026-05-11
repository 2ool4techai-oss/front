export interface HoverInfo {
  title:       string;
  description: string;
  signature:   string;
  example?:    string;
}

const HOVER_MAP: Record<string, HoverInfo> = {
  signal: {
    title:       'signal<T>(initialValue: T)',
    description: 'Creates a reactive signal. Subscribers are notified on every .set() call.',
    signature:   'function signal<T>(initialValue: T): Signal<T>',
    example:     'const count = signal(0);\ncount.set(count() + 1);',
  },
  computed: {
    title:       'computed<T>(fn: () => T)',
    description: 'Creates a derived signal. Re-evaluates lazily when dependencies change.',
    signature:   'function computed<T>(fn: () => T): ComputedSignal<T>',
    example:     'const doubled = computed(() => count() * 2);',
  },
  effect: {
    title:       'effect(fn: () => void | (() => void))',
    description: 'Runs a side effect whenever its signal dependencies change. Returns an unsubscribe function.',
    signature:   'function effect(fn: () => void | (() => void)): () => void',
    example:     'effect(() => { document.title = count().toString(); });',
  },
  batch: {
    title:       'batch(fn: () => void)',
    description: 'Groups multiple signal updates — subscribers are notified once after all updates complete.',
    signature:   'function batch(fn: () => void): void',
    example:     'batch(() => { a.set(1); b.set(2); }); // one notification',
  },
  createMachine: {
    title:       'createMachine<TState, TEvent, TContext>(config)',
    description: 'Creates a typed finite state machine. Supports entry/exit actions, guards, and history.',
    signature:   'function createMachine<TState extends string, TEvent extends string, TContext>(config: MachineConfig<TState, TEvent, TContext>): MachineHandle<TState, TEvent, TContext>',
    example:     'const m = createMachine({ initial: "idle", states: { idle: { on: { START: "running" } } } });',
  },
  label: {
    title:       'label<T>(sig: Signal<T>, name: string)',
    description: 'Names a signal for DevTools, time-travel, and audit logs. Requires dev mode.',
    signature:   'function label<T>(sig: Signal<T>, name: string): Signal<T>',
    example:     'const count = label(signal(0), "count");',
  },
};

export function getHoverInfo(word: string): HoverInfo | undefined {
  return HOVER_MAP[word];
}

export function formatHoverMarkdown(info: HoverInfo): string {
  let md = `**${info.title}**\n\n${info.description}\n\n\`\`\`typescript\n${info.signature}\n\`\`\``;
  if (info.example) md += `\n\n**Example:**\n\`\`\`typescript\n${info.example}\n\`\`\``;
  return md;
}
