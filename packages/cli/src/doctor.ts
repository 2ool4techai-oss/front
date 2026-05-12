import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface DoctorResult {
  checks: HealthCheck[];
  score: number;  // 0-100
  summary: string;
}

export function runDoctor(projectDir: string): DoctorResult {
  const checks: HealthCheck[] = [];

  // Check 1: TypeScript config exists
  const tsconfigPath = join(projectDir, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    checks.push({ name: 'TypeScript config', status: 'pass', message: 'tsconfig.json found' });
  } else {
    checks.push({ name: 'TypeScript config', status: 'fail', message: 'tsconfig.json not found' });
  }

  // Check 2: Package.json has "type": "module"
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      if (pkg['type'] === 'module') {
        checks.push({ name: 'ESM type', status: 'pass', message: 'package.json has "type": "module"' });
      } else {
        checks.push({ name: 'ESM type', status: 'warn', message: 'package.json missing "type": "module"' });
      }
    } catch {
      checks.push({ name: 'ESM type', status: 'fail', message: 'Could not parse package.json' });
    }
  } else {
    checks.push({ name: 'ESM type', status: 'fail', message: 'package.json not found' });
  }

  // Check 3: Vitest config or test script exists
  const vitestConfig = join(projectDir, 'vitest.config.ts');
  const vitestConfigJs = join(projectDir, 'vitest.config.js');
  let hasVitest = existsSync(vitestConfig) || existsSync(vitestConfigJs);

  if (!hasVitest && existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      const scripts = pkg['scripts'] as Record<string, unknown> | undefined;
      if (scripts && typeof scripts['test'] === 'string') {
        hasVitest = true;
      }
    } catch {
      // ignore
    }
  }

  if (hasVitest) {
    checks.push({ name: 'Vitest config', status: 'pass', message: 'Vitest config or test script found' });
  } else {
    checks.push({ name: 'Vitest config', status: 'warn', message: 'No Vitest config or test script found' });
  }

  // Check 4: No `any` types in package.json scripts
  let noAnyTypes = true;
  if (existsSync(pkgPath)) {
    try {
      const content = readFileSync(pkgPath, 'utf-8');
      if (content.includes(': any') || content.includes(':any')) {
        noAnyTypes = false;
      }
    } catch {
      // ignore
    }
  }
  if (noAnyTypes) {
    checks.push({ name: 'No any types', status: 'pass', message: 'No `any` types detected in package.json scripts' });
  } else {
    checks.push({ name: 'No any types', status: 'warn', message: '`any` types found in package.json scripts' });
  }

  // Check 5: @nexoraaidrishti/runtime is a dependency
  let hasDrishtiRuntime = false;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      const deps = pkg['dependencies'] as Record<string, unknown> | undefined;
      const devDeps = pkg['devDependencies'] as Record<string, unknown> | undefined;
      if ((deps && '@nexoraaidrishti/runtime' in deps) || (devDeps && '@nexoraaidrishti/runtime' in devDeps)) {
        hasDrishtiRuntime = true;
      }
    } catch {
      // ignore
    }
  }
  if (hasDrishtiRuntime) {
    checks.push({ name: '@nexoraaidrishti/runtime dependency', status: 'pass', message: '@nexoraaidrishti/runtime found in dependencies' });
  } else {
    checks.push({ name: '@nexoraaidrishti/runtime dependency', status: 'warn', message: '@nexoraaidrishti/runtime not found in dependencies' });
  }

  // Check 6: Build output directory exists (dist/)
  const distPath = join(projectDir, 'dist');
  if (existsSync(distPath)) {
    checks.push({ name: 'Build output', status: 'pass', message: 'dist/ directory exists' });
  } else {
    checks.push({ name: 'Build output', status: 'warn', message: 'dist/ directory not found — run build first' });
  }

  // Check 7: README.md exists
  const readmePath = join(projectDir, 'README.md');
  if (existsSync(readmePath)) {
    checks.push({ name: 'README.md', status: 'pass', message: 'README.md found' });
  } else {
    checks.push({ name: 'README.md', status: 'warn', message: 'README.md not found' });
  }

  const passing = checks.filter(c => c.status === 'pass').length;
  const score = Math.round((passing / checks.length) * 100);

  const failing = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warn').length;

  let summary: string;
  if (score === 100) {
    summary = `All ${checks.length} checks passed! Score: ${score}/100`;
  } else {
    summary = `Score: ${score}/100 — ${passing} passed, ${warnings} warnings, ${failing} failed`;
  }

  return { checks, score, summary };
}
