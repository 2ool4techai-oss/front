import { describe, it, expect } from 'vitest';
import {
  detectFramework,
  analyzeMigration,
  formatMigrationPlan,
  generateWrapperCode,
  generateDAPIntegration,
} from '../migrate.js';

const reactPkg = JSON.stringify({
  dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
});

const angularPkg = JSON.stringify({
  dependencies: { '@angular/core': '^17.0.0', '@angular/common': '^17.0.0' },
});

const vuePkg = JSON.stringify({
  dependencies: { vue: '^3.4.0' },
});

const unknownPkg = JSON.stringify({
  dependencies: { lodash: '^4.17.21' },
});

describe('detectFramework', () => {
  it('detects react from package.json', () => {
    expect(detectFramework(reactPkg)).toBe('react');
  });

  it('detects angular from package.json', () => {
    expect(detectFramework(angularPkg)).toBe('angular');
  });

  it('detects vue from package.json', () => {
    expect(detectFramework(vuePkg)).toBe('vue');
  });

  it('returns unknown for unrecognized dependencies', () => {
    expect(detectFramework(unknownPkg)).toBe('unknown');
  });

  it('returns unknown for invalid JSON', () => {
    expect(detectFramework('not-json')).toBe('unknown');
  });

  it('detects svelte', () => {
    const pkg = JSON.stringify({ dependencies: { svelte: '^4.0.0' } });
    expect(detectFramework(pkg)).toBe('svelte');
  });

  it('detects solid-js', () => {
    const pkg = JSON.stringify({ dependencies: { 'solid-js': '^1.8.0' } });
    expect(detectFramework(pkg)).toBe('solid');
  });

  it('prioritises angular over react when both present', () => {
    const pkg = JSON.stringify({ dependencies: { '@angular/core': '^17.0.0', react: '^18.0.0' } });
    expect(detectFramework(pkg)).toBe('angular');
  });
});

describe('analyzeMigration — react', () => {
  const plan = analyzeMigration({ framework: 'react', projectName: 'my-react-app' });

  it('returns correct framework', () => {
    expect(plan.framework).toBe('react');
  });

  it('returns projectName', () => {
    expect(plan.projectName).toBe('my-react-app');
  });

  it('returns at least 5 steps', () => {
    expect(plan.steps.length).toBeGreaterThanOrEqual(5);
  });

  it('includes app.state signal', () => {
    const names = plan.signalsToCreate.map(s => s.name);
    expect(names).toContain('app.state');
  });

  it('includes app.user signal', () => {
    const names = plan.signalsToCreate.map(s => s.name);
    expect(names).toContain('app.user');
  });

  it('signalsToCreate entries have required shape', () => {
    for (const sig of plan.signalsToCreate) {
      expect(sig).toHaveProperty('name');
      expect(sig).toHaveProperty('initialValue');
      expect(sig).toHaveProperty('description');
    }
  });

  it('installCommand references runtime package', () => {
    expect(plan.installCommand).toContain('@nexoraaidrishti/runtime');
  });

  it('installCommand references vite-plugin', () => {
    expect(plan.installCommand).toContain('@nexoraaidrishti/vite-plugin');
  });

  it('files array is non-empty', () => {
    expect(plan.files.length).toBeGreaterThan(0);
  });

  it('summary mentions framework', () => {
    expect(plan.summary.toLowerCase()).toContain('react');
  });
});

describe('analyzeMigration — angular estimatedEffort', () => {
  it('returns low for fewer than 10 files', () => {
    const plan = analyzeMigration({ framework: 'angular', files: ['a.ts', 'b.ts'] });
    expect(plan.estimatedEffort).toBe('low');
  });

  it('returns medium for 10-50 files', () => {
    const files = Array.from({ length: 20 }, (_, i) => `src/feature${i}.service.ts`);
    const plan = analyzeMigration({ framework: 'angular', files });
    expect(plan.estimatedEffort).toBe('medium');
  });

  it('returns high for more than 50 files', () => {
    const files = Array.from({ length: 60 }, (_, i) => `src/feature${i}.service.ts`);
    const plan = analyzeMigration({ framework: 'angular', files });
    expect(plan.estimatedEffort).toBe('high');
  });
});

describe('analyzeMigration — vue', () => {
  it('returns correct framework', () => {
    const plan = analyzeMigration({ framework: 'vue' });
    expect(plan.framework).toBe('vue');
  });

  it('steps mention Vuex or Pinia', () => {
    const plan = analyzeMigration({ framework: 'vue' });
    const allSteps = plan.steps.join(' ');
    expect(allSteps).toMatch(/vuex|pinia/i);
  });
});

describe('formatMigrationPlan', () => {
  it('returns a string', () => {
    const plan = analyzeMigration({ framework: 'react' });
    expect(typeof formatMigrationPlan(plan)).toBe('string');
  });

  it('contains the framework name', () => {
    const plan = analyzeMigration({ framework: 'react' });
    expect(formatMigrationPlan(plan)).toContain('react');
  });

  it('contains the project name', () => {
    const plan = analyzeMigration({ framework: 'vue', projectName: 'cool-app' });
    expect(formatMigrationPlan(plan)).toContain('cool-app');
  });

  it('contains install command', () => {
    const plan = analyzeMigration({ framework: 'angular' });
    expect(formatMigrationPlan(plan)).toContain('npm install');
  });

  it('contains migration steps', () => {
    const plan = analyzeMigration({ framework: 'react' });
    const output = formatMigrationPlan(plan);
    expect(output).toContain('1.');
  });

  it('contains signal names', () => {
    const plan = analyzeMigration({ framework: 'react' });
    expect(formatMigrationPlan(plan)).toContain('app.state');
  });
});

describe('generateWrapperCode', () => {
  it('react wrapper contains signal', () => {
    expect(generateWrapperCode('react')).toContain('signal');
  });

  it('react wrapper contains createDAPServer', () => {
    expect(generateWrapperCode('react')).toContain('createDAPServer');
  });

  it('angular wrapper contains signal', () => {
    expect(generateWrapperCode('angular')).toContain('signal');
  });

  it('angular wrapper contains DrishtiService', () => {
    expect(generateWrapperCode('angular')).toContain('DrishtiService');
  });

  it('vue wrapper contains DrishtiPlugin', () => {
    expect(generateWrapperCode('vue')).toContain('DrishtiPlugin');
  });

  it('vue wrapper contains signal', () => {
    expect(generateWrapperCode('vue')).toContain('signal');
  });

  it('unknown framework wrapper contains signal', () => {
    expect(generateWrapperCode('unknown')).toContain('signal');
  });

  it('accepts optional appEntryPoint', () => {
    const code = generateWrapperCode('react', 'src/main.tsx');
    expect(code).toContain('src/main.tsx');
  });
});

describe('generateDAPIntegration', () => {
  it('contains createDAPServer', () => {
    expect(generateDAPIntegration('react')).toContain('createDAPServer');
  });

  it('contains dap.start()', () => {
    expect(generateDAPIntegration('vue')).toContain('dap.start()');
  });

  it('contains permissions block', () => {
    expect(generateDAPIntegration('angular')).toContain('permissions');
  });

  it('contains app.state registration', () => {
    expect(generateDAPIntegration('react')).toContain("dap.register('app.state'");
  });

  it('works for all frameworks', () => {
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'solid', 'unknown'] as const;
    for (const fw of frameworks) {
      expect(() => generateDAPIntegration(fw)).not.toThrow();
    }
  });
});
