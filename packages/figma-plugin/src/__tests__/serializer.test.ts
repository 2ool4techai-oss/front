import { describe, it, expect } from 'vitest';
import { serializeNode } from '../serializer.js';
import type { FigmaNode } from '../types.js';

function frame(overrides: Partial<FigmaNode> = {}): FigmaNode {
  return { id: '1', name: 'Frame', type: 'FRAME', width: 100, height: 100, children: [], ...overrides };
}

describe('serializeNode', () => {
  it('converts FRAME to container', () => {
    const result = serializeNode(frame());
    expect(result.type).toBe('container');
    expect(result.tag).toBe('div');
  });

  it('includes width and height in style', () => {
    const result = serializeNode(frame({ width: 200, height: 150 }));
    expect(result.style['width']).toBe('200px');
    expect(result.style['height']).toBe('150px');
  });

  it('converts TEXT node to text DrNode', () => {
    const node: FigmaNode = { id: '2', name: 'Label', type: 'TEXT', characters: 'Hello' };
    const result = serializeNode(node);
    expect(result.type).toBe('text');
    expect(result.tag).toBe('span');
    expect(result.text).toBe('Hello');
  });

  it('converts ELLIPSE with border-radius 50%', () => {
    const node: FigmaNode = { id: '3', name: 'Circle', type: 'ELLIPSE', width: 40, height: 40 };
    const result = serializeNode(node);
    expect(result.style['border-radius']).toBe('50%');
  });

  it('converts IMAGE to img tag', () => {
    const node: FigmaNode = { id: '4', name: 'Photo', type: 'IMAGE', width: 80, height: 60 };
    const result = serializeNode(node);
    expect(result.tag).toBe('img');
    expect(result.type).toBe('image');
  });

  it('applies fill color to background-color', () => {
    const node: FigmaNode = {
      id: '5', name: 'Box', type: 'RECTANGLE', width: 50, height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
    };
    const result = serializeNode(node);
    expect(result.style['background-color']).toContain('255');
  });

  it('handles HORIZONTAL layoutMode as flex row', () => {
    const node: FigmaNode = { id: '6', name: 'Row', type: 'FRAME', layoutMode: 'HORIZONTAL', children: [] };
    const result = serializeNode(node);
    expect(result.style['display']).toBe('flex');
    expect(result.style['flex-direction']).toBe('row');
  });

  it('handles VERTICAL layoutMode as flex column', () => {
    const node: FigmaNode = { id: '7', name: 'Col', type: 'FRAME', layoutMode: 'VERTICAL', children: [] };
    const result = serializeNode(node);
    expect(result.style['flex-direction']).toBe('column');
  });

  it('includes gap from itemSpacing', () => {
    const node: FigmaNode = { id: '8', name: 'Row', type: 'FRAME', layoutMode: 'HORIZONTAL', itemSpacing: 12, children: [] };
    const result = serializeNode(node);
    expect(result.style['gap']).toBe('12px');
  });

  it('serializes children recursively', () => {
    const node: FigmaNode = {
      id: '9', name: 'Parent', type: 'FRAME', children: [
        { id: '10', name: 'Child', type: 'RECTANGLE', width: 20, height: 20 },
      ],
    };
    const result = serializeNode(node);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]!.name).toBe('Child');
  });

  it('marks hidden nodes with hidden attr', () => {
    const node: FigmaNode = {
      id: '11', name: 'Parent', type: 'FRAME', children: [
        { id: '12', name: 'Hidden', type: 'TEXT', visible: false, characters: 'secret' },
      ],
    };
    const result = serializeNode(node);
    const hiddenChild = result.children.find(c => c.name === 'Hidden');
    expect(hiddenChild?.attrs['hidden']).toBeDefined();
  });

  it('includes corner radius', () => {
    const node: FigmaNode = { id: '14', name: 'Card', type: 'FRAME', cornerRadius: 8, children: [] };
    const result = serializeNode(node);
    expect(result.style['border-radius']).toBe('8px');
  });
});
