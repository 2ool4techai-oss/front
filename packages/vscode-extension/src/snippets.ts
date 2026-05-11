export interface Snippet {
  prefix:      string;
  body:        string[];
  description: string;
}

export const DRISHTI_SNIPPETS: Record<string, Snippet> = {
  'dr-signal': {
    prefix: 'drsig',
    body: ['const ${1:name} = signal(${2:initialValue});'],
    description: 'Create a DRISHTI signal',
  },
  'dr-computed': {
    prefix: 'drcom',
    body: ['const ${1:name} = computed(() => ${2:expression});'],
    description: 'Create a computed signal',
  },
  'dr-effect': {
    prefix: 'dreff',
    body: ['effect(() => {', '  ${1:// reactive side effect}', '});'],
    description: 'Create a reactive effect',
  },
  'dr-store': {
    prefix: 'drstore',
    body: ['const ${1:store} = createStore({', '  ${2:key}: ${3:value},', '});'],
    description: 'Create a signal store',
  },
  'dr-machine': {
    prefix: 'drmachine',
    body: [
      'const ${1:machine} = createMachine({',
      '  initial: \'${2:idle}\',',
      '  states: {',
      '    ${2:idle}: { on: { ${3:START}: \'${4:active}\' } },',
      '    ${4:active}: { type: \'final\' },',
      '  },',
      '});',
    ],
    description: 'Create a state machine',
  },
  'dr-component': {
    prefix: 'drcomp',
    body: [
      'export function ${1:Component}(): HTMLElement {',
      '  return h(\'div\', { class: \'${2:container}\' },',
      '    ${3:// children}',
      '  );',
      '}',
    ],
    description: 'Create a DRISHTI component',
  },
};

export function getSnippet(name: string): Snippet | undefined {
  return DRISHTI_SNIPPETS[name];
}

export function getAllSnippets(): Snippet[] {
  return Object.values(DRISHTI_SNIPPETS);
}
