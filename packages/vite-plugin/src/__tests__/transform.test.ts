import { describe, it, expect } from 'vitest';
import { transformDrFile } from '../transform.js';

const FULL_COMPONENT = `
<script>
import { signal } from '@nexoraaidrishti/runtime';
const count = signal(0);
</script>

<template>
  <div class="app">
    <span>{count()}</span>
    <button on:click={() => count.set(count() + 1)}>+</button>
  </div>
</template>

<style>
.app { padding: 16px; }
</style>
`;

describe('transformDrFile', () => {
  it('produces valid JS string', () => {
    const result = transformDrFile(FULL_COMPONENT, 'Counter.dr');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('imports from @nexoraaidrishti/runtime', () => {
    const result = transformDrFile(FULL_COMPONENT, 'Counter.dr');
    expect(result).toContain('@nexoraaidrishti/runtime');
  });

  it('removes duplicate runtime import from user script', () => {
    const result = transformDrFile(FULL_COMPONENT, 'Counter.dr');
    // Should not have duplicate import
    const importCount = (result.match(/from '@drishti\/runtime'/g) || []).length;
    expect(importCount).toBe(1);
  });

  it('includes render function', () => {
    const result = transformDrFile(FULL_COMPONENT, 'Counter.dr');
    expect(result).toContain('function render()');
  });

  it('includes default export', () => {
    const result = transformDrFile(FULL_COMPONENT, 'Counter.dr');
    expect(result).toContain('export default render');
  });

  it('injects style into DOM', () => {
    const result = transformDrFile(FULL_COMPONENT, 'Counter.dr');
    expect(result).toContain('document.createElement');
    expect(result).toContain('padding: 16px');
  });

  it('handles component with no style', () => {
    const noStyle = '<script>const x = 1;</script><template><div></div></template>';
    expect(() => transformDrFile(noStyle, 'test.dr')).not.toThrow();
  });

  it('handles component with no script', () => {
    const noScript = '<template><div>static</div></template>';
    const result = transformDrFile(noScript, 'test.dr');
    expect(result).toContain('function render()');
  });

  it('preserves user script content', () => {
    const result = transformDrFile(FULL_COMPONENT, 'Counter.dr');
    expect(result).toContain('count = signal(0)');
  });

  it('injects style tag with unique id', () => {
    const result = transformDrFile(FULL_COMPONENT, 'Counter.dr');
    expect(result).toContain('dr-style-');
  });

  it('handles component with no blocks', () => {
    const empty = '';
    const result = transformDrFile(empty, 'empty.dr');
    expect(result).toContain('function render()');
  });

  it('renders static div as fallback when no template', () => {
    const noTemplate = '<script>const x = 1;</script>';
    const result = transformDrFile(noTemplate, 'test.dr');
    expect(result).toContain("h('div'");
  });

  it('does not include style injection when no style block', () => {
    const noStyle = '<template><div>hi</div></template>';
    const result = transformDrFile(noStyle, 'test.dr');
    expect(result).not.toContain('document.createElement');
  });
});
