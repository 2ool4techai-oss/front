import { describe, it, expect } from 'vitest';
import { parseDrFile } from '../parser.js';

const SAMPLE = `
<script>
const x = 1;
</script>

<template>
  <div>hello</div>
</template>

<style>
.foo { color: red; }
</style>
`;

describe('parseDrFile', () => {
  it('extracts script block', () => {
    const result = parseDrFile(SAMPLE);
    expect(result.script).toContain('const x = 1');
  });

  it('extracts template block', () => {
    const result = parseDrFile(SAMPLE);
    expect(result.template).toContain('<div>hello</div>');
  });

  it('extracts style block', () => {
    const result = parseDrFile(SAMPLE);
    expect(result.style).toContain('.foo { color: red; }');
  });

  it('returns undefined for missing blocks', () => {
    const result = parseDrFile('<template><div/></template>');
    expect(result.script).toBeUndefined();
    expect(result.style).toBeUndefined();
  });

  it('handles file with only template', () => {
    const result = parseDrFile('<template><span>hi</span></template>');
    expect(result.template).toContain('<span>hi</span>');
  });

  it('trims block content', () => {
    const result = parseDrFile('<script>\n  const a = 1;\n</script><template><div/></template>');
    expect(result.script).toBe('const a = 1;');
  });

  it('handles multiline script', () => {
    const src = `<script>\nconst a = 1;\nconst b = 2;\n</script><template><div/></template>`;
    const result = parseDrFile(src);
    expect(result.script).toContain('const a = 1');
    expect(result.script).toContain('const b = 2');
  });

  it('handles script with attributes', () => {
    const result = parseDrFile('<script lang="ts">const x = 1;</script><template><div/></template>');
    expect(result.script).toBe('const x = 1;');
  });

  it('handles style with attributes', () => {
    const result = parseDrFile('<template><div/></template><style scoped>.x{}</style>');
    expect(result.style).toBe('.x{}');
  });

  it('returns empty object for empty string', () => {
    const result = parseDrFile('');
    expect(result.script).toBeUndefined();
    expect(result.template).toBeUndefined();
    expect(result.style).toBeUndefined();
  });
});
