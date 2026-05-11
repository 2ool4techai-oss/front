import { describe, it, expect } from 'vitest';
import { transformVue } from '../codemods/vue.js';

describe('transformVue', () => {
  it('transforms ref() to signal()', () => {
    const code = `const count = ref(0);`;
    const result = transformVue(code);
    expect(result.code).toContain('const count = signal(0)');
    expect(result.code).not.toContain('ref(');
  });

  it('transforms multiple ref() calls', () => {
    const code = `const a = ref(0);\nconst b = ref('hello');`;
    const result = transformVue(code);
    expect(result.code).toContain('const a = signal(0)');
    expect(result.code).toContain("const b = signal('hello')");
  });

  it('transforms Vue named imports to Drishti imports', () => {
    const code = `import { ref, computed, watch, onMounted } from 'vue';`;
    const result = transformVue(code);
    expect(result.code).toContain("from '@drishti/runtime'");
    expect(result.code).not.toContain("from 'vue'");
  });

  it('transforms .value reads to signal calls', () => {
    const code = `const x = count.value + 1;`;
    const result = transformVue(code);
    expect(result.code).toContain('count()');
    expect(result.code).not.toContain('.value');
  });

  it('transforms .value writes to .set()', () => {
    const code = `count.value = 42;`;
    const result = transformVue(code);
    expect(result.code).toContain('count.set(42)');
    expect(result.code).not.toContain('.value =');
  });

  it('transforms computed() — passes through unchanged', () => {
    const code = `const doubled = computed(() => count() * 2);`;
    const result = transformVue(code);
    expect(result.code).toContain('computed(');
  });

  it('transforms watch() to effect()', () => {
    const code = `watch(count, (val) => { console.log(val); });`;
    const result = transformVue(code);
    expect(result.code).toContain('effect(');
    expect(result.code).not.toContain('watch(');
  });

  it('transforms onMounted() to IIFE with comment', () => {
    const code = `onMounted(() => { init(); });`;
    const result = transformVue(code);
    expect(result.code).toContain('// Run on mount:');
    expect(result.code).toContain('(() =>');
    expect(result.code).not.toContain('onMounted');
  });

  it('transforms reactive() to createStore()', () => {
    const code = `const state = reactive({ count: 0, name: 'Alice' });`;
    const result = transformVue(code);
    expect(result.code).toContain('createStore(');
    expect(result.code).not.toContain('reactive(');
  });

  it('records changes for all transformations', () => {
    const code = [
      `import { ref, watch } from 'vue';`,
      `const count = ref(0);`,
      `watch(count, (val) => { console.log(val); });`,
    ].join('\n');
    const result = transformVue(code);
    expect(result.changes.length).toBeGreaterThan(0);
    // Each change has required shape
    for (const change of result.changes) {
      expect(change).toHaveProperty('line');
      expect(change).toHaveProperty('from');
      expect(change).toHaveProperty('to');
    }
  });
});
