#!/usr/bin/env node
import * as fs   from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// ── ANSI colors ────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  white:  '\x1b[97m',
  gray:   '\x1b[90m',
};
const ok  = `${c.green}✓${c.reset}`;
const err = `${c.red}✗${c.reset}`;

// ── Entry ──────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const appName = args[0] ?? promptName();

if (!appName || !/^[a-z][a-z0-9-_]*$/.test(appName)) {
  console.error(`${err} Invalid project name "${appName}". Use lowercase letters, numbers, hyphens.`);
  process.exit(1);
}

const targetDir = path.resolve(process.cwd(), appName);

if (fs.existsSync(targetDir)) {
  console.error(`${err} Directory "${appName}" already exists.`);
  process.exit(1);
}

console.log('');
console.log(`${c.bold}${c.cyan}  DRISHTI${c.reset}  ${c.dim}AI-Native Frontend Runtime${c.reset}`);
console.log(`${c.gray}  Sees · Feels · Heals · Protects${c.reset}`);
console.log('');
console.log(`  Creating ${c.bold}${appName}${c.reset}…`);
console.log('');

// ── Scaffold ───────────────────────────────────────────────────────────
fs.mkdirSync(targetDir, { recursive: true });

writeFile(targetDir, 'package.json',            packageJson(appName));
writeFile(targetDir, 'vite.config.ts',          viteConfig());
writeFile(targetDir, 'tsconfig.json',           tsConfig());
writeFile(targetDir, 'index.html',              indexHtml(appName));
writeFile(targetDir, 'src/main.ts',             mainTs());
writeFile(targetDir, 'src/App.ts',              appTs());
writeFile(targetDir, 'src/App.dr',              appDr());
writeFile(targetDir, '.gitignore',              gitignore());
writeFile(targetDir, 'README.md',               readme(appName));

console.log(`  ${ok} ${c.dim}package.json${c.reset}`);
console.log(`  ${ok} ${c.dim}vite.config.ts${c.reset}`);
console.log(`  ${ok} ${c.dim}src/main.ts${c.reset}`);
console.log(`  ${ok} ${c.dim}src/App.ts  +  src/App.dr${c.reset}`);
console.log('');

// ── Install deps ───────────────────────────────────────────────────────
const pm = detectPM();
console.log(`  Installing dependencies with ${c.bold}${pm}${c.reset}…`);
try {
  execSync(`${pm} install`, { cwd: targetDir, stdio: 'inherit' });
  console.log('');
  console.log(`  ${ok} Done!`);
} catch {
  console.warn(`  ${c.yellow}⚠${c.reset}  Could not install automatically. Run ${c.bold}${pm} install${c.reset} inside the project.`);
}

// ── Done ───────────────────────────────────────────────────────────────
console.log('');
console.log(`${c.bold}${c.green}  Ready!${c.reset}  Start building:`);
console.log('');
console.log(`    ${c.cyan}cd ${appName}${c.reset}`);
console.log(`    ${c.cyan}${pm} dev${c.reset}`);
console.log('');
console.log(`  Open ${c.bold}http://localhost:5173${c.reset} in your browser.`);
console.log('');

// ── Helpers ────────────────────────────────────────────────────────────
function writeFile(base: string, rel: string, content: string): void {
  const full = path.join(base, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function detectPM(): string {
  try { execSync('pnpm --version', { stdio: 'ignore' }); return 'pnpm'; } catch {}
  try { execSync('yarn --version', { stdio: 'ignore' }); return 'yarn'; } catch {}
  return 'npm';
}

function promptName(): string {
  // Very simple inline prompt for when no arg is passed
  process.stdout.write('  Project name: ');
  const buf = Buffer.alloc(256);
  const n = fs.readSync(0, buf, 0, 256, null);
  return buf.slice(0, n).toString().trim();
}

// ── Template files ─────────────────────────────────────────────────────
function packageJson(name: string): string {
  return JSON.stringify({
    name,
    version: '0.0.1',
    type: 'module',
    scripts: {
      dev:       'vite',
      build:     'vite build',
      preview:   'vite preview',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@drishti/runtime':    '^0.1.0',
      '@drishti/components': '^0.1.0',
      '@drishti/compiler':   '^0.1.0',
    },
    devDependencies: {
      vite:        '^5.0.0',
      typescript:  '^5.4.0',
    },
  }, null, 2) + '\n';
}

function viteConfig(): string {
  return `import { defineConfig } from 'vite';
import { drishtiPlugin } from '@drishti/compiler/vite-plugin';

export default defineConfig({
  plugins: [drishtiPlugin()],
  server: { port: 5173, open: true },
});
`;
}

function tsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      skipLibCheck: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      paths: { '@drishti/runtime': ['./node_modules/@drishti/runtime/dist/index.d.ts'] },
    },
    include: ['src'],
  }, null, 2) + '\n';
}

function indexHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #07070f; color: #e2e8f0; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`;
}

function mainTs(): string {
  return `import { loadGenome, loadGenomePreset } from '@drishti/runtime';
import { App } from './App.js';

// Load brand design tokens (pick a preset or pass your own config)
loadGenomePreset('midnight');

const app = document.getElementById('app')!;
app.appendChild(App());
`;
}

function appTs(): string {
  return `import { signal, effect, h } from '@drishti/runtime';
import { Button, toast } from '@drishti/components';

export function App(): HTMLElement {
  const count = signal(0);

  const counter = h('div', { style: { padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px' } },
    h('h1', { style: { fontSize: '2rem', fontWeight: '800' } }, 'DRISHTI App'),
    h('p', {}, () => \`Count: \${count()}\`),
    Button({
      label: 'Increment',
      variant: 'primary',
      onClick: () => {
        count.set(count.peek() + 1);
        if (count.peek() % 5 === 0) toast.success(\`Milestone: \${count.peek()}!\`);
      },
    }),
  );

  return counter;
}
`;
}

function appDr(): string {
  return `# App.dr — declarative DRISHTI surface
# Import this file as: import './App.dr'
# The Vite plugin compiles it to ESM automatically.

surface: App
  intent: main application surface

  unit: Counter
    data: connect(/api/counter)
    feel: celebrate if count > 100
    heal: retry(3) then empty-state
    secure: public
`;
}

function gitignore(): string {
  return `node_modules/
dist/
.env
.env.local
`;
}

function readme(name: string): string {
  return `# ${name}

Built with [DRISHTI](https://github.com/2ool4techai-oss/front) — AI-native frontend runtime.

## Start

\`\`\`bash
pnpm dev
\`\`\`

## What's included

- \`src/main.ts\`  — entry point, loads Genome (design tokens)
- \`src/App.ts\`   — TypeScript component using signals + h()
- \`src/App.dr\`   — declarative .dr surface (compiled by Vite plugin)
- \`vite.config.ts\` — Vite + DRISHTI plugin

## Docs

- Runtime API: \`import { signal, computed, effect, spring } from '@drishti/runtime'\`
- Components:  \`import { Button, Input, Modal, toast } from '@drishti/components'\`
- Router:      \`import { createRouter } from '@drishti/runtime'\`
`;
}
