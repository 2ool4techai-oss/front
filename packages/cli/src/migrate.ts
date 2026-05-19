export type Framework = 'react' | 'vue' | 'angular' | 'svelte' | 'solid' | 'unknown';

export interface MigrationFile {
  path: string;
  action: 'wrap' | 'transform' | 'create' | 'skip';
  description: string;
  before?: string;
  after?: string;
}

export interface MigrationPlan {
  framework: Framework;
  projectName: string;
  files: MigrationFile[];
  steps: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  signalsToCreate: { name: string; initialValue: unknown; description: string }[];
  installCommand: string;
  summary: string;
}

export function detectFramework(packageJsonContent: string): Framework {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(packageJsonContent) as Record<string, unknown>;
  } catch {
    return 'unknown';
  }

  const deps = {
    ...((pkg['dependencies'] as Record<string, string>) ?? {}),
    ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
    ...((pkg['peerDependencies'] as Record<string, string>) ?? {}),
  };

  if ('@angular/core' in deps) return 'angular';
  if ('react' in deps) return 'react';
  if ('vue' in deps) return 'vue';
  if ('svelte' in deps) return 'svelte';
  if ('solid-js' in deps) return 'solid';
  return 'unknown';
}

function getEffort(fileCount: number): 'low' | 'medium' | 'high' {
  if (fileCount < 10) return 'low';
  if (fileCount <= 50) return 'medium';
  return 'high';
}

const BASE_SIGNALS = [
  { name: 'app.state', initialValue: {}, description: 'Root application state' },
  { name: 'app.user', initialValue: null, description: 'Current user session' },
];

function reactMigrationFiles(files: string[]): MigrationFile[] {
  const result: MigrationFile[] = [];

  if (files.length === 0) {
    result.push({
      path: 'src/main.tsx',
      action: 'wrap',
      description: 'Wrap React app entry point with DRISHTI signal bridge',
      before: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);`,
      after: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport { appState, currentUser, dap } from './drishti-wrapper';\ndap.start();\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);`,
    });
    result.push({
      path: 'src/drishti-wrapper.ts',
      action: 'create',
      description: 'Create DRISHTI signal bridge file',
      after: generateWrapperCode('react'),
    });
    return result;
  }

  for (const file of files) {
    if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      result.push({
        path: file,
        action: 'transform',
        description: 'Replace useState/useReducer with DRISHTI signals, bridge Context with signal store',
        before: `const [count, setCount] = useState(0);`,
        after: `const count = useSignal(appState.get('count') ?? 0);`,
      });
    } else {
      result.push({ path: file, action: 'skip', description: 'No migration needed for non-component files' });
    }
  }

  return result;
}

function angularMigrationFiles(files: string[]): MigrationFile[] {
  const result: MigrationFile[] = [];

  if (files.length === 0) {
    result.push({
      path: 'src/app/app.module.ts',
      action: 'wrap',
      description: 'Inject DrishtiService into root module',
      before: `@NgModule({ declarations: [AppComponent], bootstrap: [AppComponent] })\nexport class AppModule {}`,
      after: `import { DrishtiService } from './drishti.service';\n@NgModule({ declarations: [AppComponent], providers: [DrishtiService], bootstrap: [AppComponent] })\nexport class AppModule {}`,
    });
    result.push({
      path: 'src/app/drishti.service.ts',
      action: 'create',
      description: 'Create DrishtiService wrapping signal store',
      after: generateWrapperCode('angular'),
    });
    return result;
  }

  for (const file of files) {
    if (file.endsWith('.service.ts')) {
      result.push({
        path: file,
        action: 'transform',
        description: 'Replace Angular service state with DRISHTI signal store, replace EventEmitter with signal effects',
        before: `readonly changed = new EventEmitter<State>();`,
        after: `readonly changed = computed(() => appState.get());`,
      });
    } else if (file.endsWith('.component.ts')) {
      result.push({
        path: file,
        action: 'wrap',
        description: 'Inject DrishtiService and bind signals to component properties',
      });
    } else {
      result.push({ path: file, action: 'skip', description: 'No migration needed' });
    }
  }

  return result;
}

function vueMigrationFiles(files: string[]): MigrationFile[] {
  const result: MigrationFile[] = [];

  if (files.length === 0) {
    result.push({
      path: 'src/main.ts',
      action: 'wrap',
      description: 'Register DRISHTI Vue plugin in app entry point',
      before: `import { createApp } from 'vue';\nimport App from './App.vue';\ncreateApp(App).mount('#app');`,
      after: `import { createApp } from 'vue';\nimport App from './App.vue';\nimport { DrishtiPlugin } from '@nexoraaidrishti/runtime/vue';\ncreateApp(App).use(DrishtiPlugin).mount('#app');`,
    });
    result.push({
      path: 'src/drishti-wrapper.ts',
      action: 'create',
      description: 'Create DRISHTI signal bridge for Vue',
      after: generateWrapperCode('vue'),
    });
    return result;
  }

  for (const file of files) {
    if (file.endsWith('.vue')) {
      result.push({
        path: file,
        action: 'transform',
        description: 'Replace ref/reactive with DRISHTI signals, replace Vuex/Pinia store with signal store',
        before: `const count = ref(0);\nconst state = reactive({ user: null });`,
        after: `const count = useSignal(appState.get('count') ?? 0);\nconst user = useSignal(currentUser.get());`,
      });
    } else {
      result.push({ path: file, action: 'skip', description: 'No migration needed' });
    }
  }

  return result;
}

function genericMigrationFiles(files: string[], framework: Framework): MigrationFile[] {
  if (files.length === 0) {
    return [
      {
        path: 'src/drishti-wrapper.ts',
        action: 'create',
        description: `Create DRISHTI signal bridge for ${framework} app`,
        after: generateWrapperCode(framework),
      },
    ];
  }
  return files.map(file => ({
    path: file,
    action: 'wrap' as const,
    description: 'Wrap with DRISHTI signal bridge',
  }));
}

function getSteps(framework: Framework): string[] {
  const shared = [
    `Run the install command to add DRISHTI runtime and vite plugin`,
    `Create drishti-wrapper.ts with signal definitions and DAP server`,
    `Start the DAP server in your app entry point`,
    `Verify signals are accessible via the DAP debug interface`,
    `Remove legacy state management once signals are confirmed working`,
  ];

  switch (framework) {
    case 'react':
      return [
        `Run the install command to add DRISHTI runtime and vite plugin`,
        `Create drishti-wrapper.ts and import it in src/main.tsx`,
        `Wrap top-level useState calls with DRISHTI signal equivalents`,
        `Replace React Context providers with signal store subscriptions`,
        `Replace useReducer with signal-backed reducers`,
        `Start the DAP server and verify AI agents can connect`,
        `Remove React-specific state boilerplate once signals are stable`,
      ];
    case 'angular':
      return [
        `Run the install command to add DRISHTI runtime and vite plugin`,
        `Generate DrishtiService and register it in your root NgModule`,
        `Replace Angular service state properties with signal store entries`,
        `Replace EventEmitter outputs with signal effects`,
        `Update component templates to subscribe to signal observables`,
        `Start the DAP server in the app bootstrap sequence`,
        `Remove legacy service state and EventEmitter patterns`,
      ];
    case 'vue':
      return [
        `Run the install command to add DRISHTI runtime and vite plugin`,
        `Register the DRISHTI Vue plugin in src/main.ts`,
        `Replace ref and reactive calls with DRISHTI signals`,
        `Replace Vuex/Pinia store modules with signal store namespaces`,
        `Update component setup functions to use signal subscriptions`,
        `Start the DAP server and confirm AI agents can inspect state`,
        `Remove Vuex/Pinia dependencies once migration is complete`,
      ];
    default:
      return shared;
  }
}

export function analyzeMigration(options: {
  framework: Framework;
  projectName?: string;
  files?: string[];
}): MigrationPlan {
  const { framework, projectName = 'my-app', files = [] } = options;

  let migrationFiles: MigrationFile[];
  switch (framework) {
    case 'react':
      migrationFiles = reactMigrationFiles(files);
      break;
    case 'angular':
      migrationFiles = angularMigrationFiles(files);
      break;
    case 'vue':
      migrationFiles = vueMigrationFiles(files);
      break;
    default:
      migrationFiles = genericMigrationFiles(files, framework);
  }

  const fileCount = files.length > 0 ? files.length : migrationFiles.length;
  const estimatedEffort = getEffort(fileCount);
  const steps = getSteps(framework);

  const frameworkLabel = framework === 'unknown' ? 'your existing' : framework;

  return {
    framework,
    projectName,
    files: migrationFiles,
    steps,
    estimatedEffort,
    signalsToCreate: [
      ...BASE_SIGNALS,
      { name: 'app.loading', initialValue: false, description: 'Global loading state' },
      { name: 'app.error', initialValue: null, description: 'Global error state' },
    ],
    installCommand: 'npm install @nexoraaidrishti/runtime @nexoraaidrishti/vite-plugin',
    summary: `Migrate ${projectName} from ${frameworkLabel} to DRISHTI signal-driven architecture. ${migrationFiles.length} file(s) identified, estimated effort: ${estimatedEffort}.`,
  };
}

export function formatMigrationPlan(plan: MigrationPlan): string {
  const lines: string[] = [];
  const divider = '─'.repeat(60);

  lines.push(divider);
  lines.push(`DRISHTI Migration Plan — ${plan.projectName}`);
  lines.push(divider);
  lines.push('');
  lines.push(`Framework:        ${plan.framework}`);
  lines.push(`Estimated effort: ${plan.estimatedEffort}`);
  lines.push(`Files affected:   ${plan.files.length}`);
  lines.push('');
  lines.push('Install:');
  lines.push(`  ${plan.installCommand}`);
  lines.push('');
  lines.push('Summary:');
  lines.push(`  ${plan.summary}`);
  lines.push('');
  lines.push('Migration steps:');
  plan.steps.forEach((step, i) => {
    lines.push(`  ${i + 1}. ${step}`);
  });
  lines.push('');
  lines.push('Signals to create:');
  for (const sig of plan.signalsToCreate) {
    lines.push(`  signal("${sig.name}")  —  ${sig.description}`);
  }
  lines.push('');
  lines.push('Files:');
  for (const file of plan.files) {
    lines.push(`  [${file.action.toUpperCase().padEnd(9)}] ${file.path}`);
    lines.push(`             ${file.description}`);
    if (file.before) {
      lines.push('');
      lines.push('             Before:');
      file.before.split('\n').forEach(l => lines.push(`               ${l}`));
    }
    if (file.after) {
      lines.push('');
      lines.push('             After:');
      file.after.split('\n').forEach(l => lines.push(`               ${l}`));
    }
    lines.push('');
  }
  lines.push(divider);

  return lines.join('\n');
}

export function generateWrapperCode(framework: Framework, appEntryPoint?: string): string {
  switch (framework) {
    case 'react':
      return [
        `// drishti-wrapper.ts - Add to your React app entry point${appEntryPoint ? ` (${appEntryPoint})` : ''}`,
        `import { createDAPServer, signal, computed } from '@nexoraaidrishti/runtime';`,
        ``,
        `export const appState = signal({});`,
        `export const currentUser = signal(null);`,
        `export const isLoading = signal(false);`,
        `export const appError = signal(null);`,
        ``,
        `export const isAuthenticated = computed(() => currentUser.get() !== null);`,
        ``,
        `export const dap = createDAPServer({ permissions: { read: ['*'], write: ['*'], watch: ['*'] } });`,
        `dap.register('app.state', appState);`,
        `dap.register('app.user', currentUser);`,
        `dap.register('app.loading', isLoading);`,
        `dap.register('app.error', appError);`,
      ].join('\n');

    case 'angular':
      return [
        `// drishti.service.ts - Inject into your Angular root module${appEntryPoint ? ` (${appEntryPoint})` : ''}`,
        `import { Injectable } from '@angular/core';`,
        `import { createDAPServer, signal, computed } from '@nexoraaidrishti/runtime';`,
        ``,
        `@Injectable({ providedIn: 'root' })`,
        `export class DrishtiService {`,
        `  readonly appState = signal({});`,
        `  readonly currentUser = signal(null);`,
        `  readonly isLoading = signal(false);`,
        `  readonly appError = signal(null);`,
        ``,
        `  readonly isAuthenticated = computed(() => this.currentUser.get() !== null);`,
        ``,
        `  private dap = createDAPServer({ permissions: { read: ['*'], write: ['*'], watch: ['*'] } });`,
        ``,
        `  constructor() {`,
        `    this.dap.register('app.state', this.appState);`,
        `    this.dap.register('app.user', this.currentUser);`,
        `    this.dap.register('app.loading', this.isLoading);`,
        `    this.dap.register('app.error', this.appError);`,
        `    this.dap.start();`,
        `  }`,
        `}`,
      ].join('\n');

    case 'vue':
      return [
        `// drishti-wrapper.ts - Register DrishtiPlugin in src/main.ts${appEntryPoint ? ` (${appEntryPoint})` : ''}`,
        `import { createDAPServer, signal, computed } from '@nexoraaidrishti/runtime';`,
        ``,
        `export const appState = signal({});`,
        `export const currentUser = signal(null);`,
        `export const isLoading = signal(false);`,
        `export const appError = signal(null);`,
        ``,
        `export const isAuthenticated = computed(() => currentUser.get() !== null);`,
        ``,
        `export const dap = createDAPServer({ permissions: { read: ['*'], write: ['*'], watch: ['*'] } });`,
        `dap.register('app.state', appState);`,
        `dap.register('app.user', currentUser);`,
        `dap.register('app.loading', isLoading);`,
        `dap.register('app.error', appError);`,
        ``,
        `export const DrishtiPlugin = {`,
        `  install(app: { config: { globalProperties: Record<string, unknown> } }) {`,
        `    app.config.globalProperties.$drishti = { appState, currentUser, isLoading, appError, dap };`,
        `    dap.start();`,
        `  },`,
        `};`,
      ].join('\n');

    case 'svelte':
      return [
        `// drishti-wrapper.ts - Import in your Svelte app entry${appEntryPoint ? ` (${appEntryPoint})` : ''}`,
        `import { createDAPServer, signal, computed } from '@nexoraaidrishti/runtime';`,
        ``,
        `export const appState = signal({});`,
        `export const currentUser = signal(null);`,
        `export const isLoading = signal(false);`,
        `export const appError = signal(null);`,
        ``,
        `export const isAuthenticated = computed(() => currentUser.get() !== null);`,
        ``,
        `export const dap = createDAPServer({ permissions: { read: ['*'], write: ['*'], watch: ['*'] } });`,
        `dap.register('app.state', appState);`,
        `dap.register('app.user', currentUser);`,
        `dap.register('app.loading', isLoading);`,
        `dap.register('app.error', appError);`,
      ].join('\n');

    case 'solid':
      return [
        `// drishti-wrapper.ts - Import in your SolidJS app entry${appEntryPoint ? ` (${appEntryPoint})` : ''}`,
        `import { createDAPServer, signal, computed } from '@nexoraaidrishti/runtime';`,
        ``,
        `export const appState = signal({});`,
        `export const currentUser = signal(null);`,
        `export const isLoading = signal(false);`,
        `export const appError = signal(null);`,
        ``,
        `export const isAuthenticated = computed(() => currentUser.get() !== null);`,
        ``,
        `export const dap = createDAPServer({ permissions: { read: ['*'], write: ['*'], watch: ['*'] } });`,
        `dap.register('app.state', appState);`,
        `dap.register('app.user', currentUser);`,
        `dap.register('app.loading', isLoading);`,
        `dap.register('app.error', appError);`,
      ].join('\n');

    default:
      return [
        `// drishti-wrapper.ts - Generic DRISHTI signal bridge${appEntryPoint ? ` for ${appEntryPoint}` : ''}`,
        `import { createDAPServer, signal, computed } from '@nexoraaidrishti/runtime';`,
        ``,
        `export const appState = signal({});`,
        `export const currentUser = signal(null);`,
        `export const isLoading = signal(false);`,
        `export const appError = signal(null);`,
        ``,
        `export const isAuthenticated = computed(() => currentUser.get() !== null);`,
        ``,
        `export const dap = createDAPServer({ permissions: { read: ['*'], write: ['*'], watch: ['*'] } });`,
        `dap.register('app.state', appState);`,
        `dap.register('app.user', currentUser);`,
        `dap.register('app.loading', isLoading);`,
        `dap.register('app.error', appError);`,
        `dap.start();`,
      ].join('\n');
  }
}

export function generateDAPIntegration(framework: Framework): string {
  const serviceFile = framework === 'angular' ? 'DrishtiService constructor' : 'your app entry point';

  return [
    `// DAP server integration — add to ${serviceFile}`,
    `import { createDAPServer } from '@nexoraaidrishti/runtime';`,
    ``,
    `const dap = createDAPServer({`,
    `  port: 4922,`,
    `  permissions: {`,
    `    read:  ['*'],`,
    `    write: ['*'],`,
    `    watch: ['*'],`,
    `  },`,
    `});`,
    ``,
    `dap.register('app.state', appState);`,
    `dap.register('app.user', currentUser);`,
    ``,
    `dap.start();`,
    ``,
    `// AI agents connect via DAP protocol:`,
    `//   dap connect localhost:4922`,
    `//   dap read app.state`,
    `//   dap write app.user '{"id":1,"name":"Alice"}'`,
    `//   dap watch app.state`,
  ].join('\n');
}
