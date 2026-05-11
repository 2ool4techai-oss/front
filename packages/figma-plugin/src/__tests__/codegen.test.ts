import { describe, it, expect } from 'vitest';
import { generateDrFile } from '../codegen.js';
import type { DrNode } from '../serializer.js';

function makeNode(overrides: Partial<DrNode> = {}): DrNode {
  return {
    type: 'container',
    tag: 'div',
    name: 'MyComponent',
    attrs: {},
    style: { width: '100px', height: '100px' },
    children: [],
    ...overrides,
  };
}

describe('generateDrFile', () => {
  it('generates a .dr file string', () => {
    const result = generateDrFile(makeNode());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes script block', () => {
    const result = generateDrFile(makeNode());
    expect(result).toContain('<script>');
    expect(result).toContain('</script>');
  });

  it('includes template block', () => {
    const result = generateDrFile(makeNode());
    expect(result).toContain('<template>');
    expect(result).toContain('</template>');
  });

  it('includes style block when node has style', () => {
    const result = generateDrFile(makeNode());
    expect(result).toContain('<style>');
  });

  it('includes component name in comment', () => {
    const result = generateDrFile(makeNode({ name: 'HeroCard' }), { componentName: 'HeroCard' });
    expect(result).toContain('HeroCard');
  });

  it('generates text node content', () => {
    const textNode: DrNode = {
      type: 'text', tag: 'span', name: 'Title', attrs: {},
      style: {}, children: [], text: 'Hello World',
    };
    const result = generateDrFile(makeNode({ children: [textNode] }));
    expect(result).toContain('Hello World');
  });

  it('generates img tag for image nodes', () => {
    const imgNode: DrNode = {
      type: 'image', tag: 'img', name: 'Photo', attrs: { src: '', alt: 'Photo' },
      style: { width: '80px' }, children: [],
    };
    const result = generateDrFile(makeNode({ children: [imgNode] }));
    expect(result).toContain('<img');
  });

  it('addSignals scaffolds signal for text content', () => {
    const textNode: DrNode = {
      type: 'text', tag: 'span', name: 'Label', attrs: {},
      style: {}, children: [], text: 'Click me',
    };
    const result = generateDrFile(makeNode({ children: [textNode] }), { addSignals: true });
    expect(result).toContain('signal(');
  });

  it('includes @drishti/runtime import', () => {
    const result = generateDrFile(makeNode());
    expect(result).toContain('@drishti/runtime');
  });
});
