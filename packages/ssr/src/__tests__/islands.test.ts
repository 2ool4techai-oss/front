import { describe, it, expect } from 'vitest';
import { VNode } from '../vdom.js';
import { collectIslands, renderIslandPage } from '../islands.js';

function makeIslandNode(name: string, propsJson: string): VNode {
  const node = new VNode('div');
  node.setAttribute('data-island', name);
  node.setAttribute('data-island-props', propsJson);
  return node;
}

describe('collectIslands', () => {
  it('finds islands in VNode tree', () => {
    const root = new VNode('div');
    const island = makeIslandNode('counter', JSON.stringify({ start: 0 }));
    root.appendChild(island);

    const result = collectIslands(root);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('counter');
    expect(result[0]!.props).toEqual({ start: 0 });
    expect(result[0]!.count).toBe(1);
  });

  it('counts multiple uses of same island', () => {
    const root = new VNode('div');
    root.appendChild(makeIslandNode('counter', JSON.stringify({ start: 0 })));
    root.appendChild(makeIslandNode('counter', JSON.stringify({ start: 10 })));
    root.appendChild(makeIslandNode('counter', JSON.stringify({ start: 20 })));

    const result = collectIslands(root);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('counter');
    expect(result[0]!.count).toBe(3);
  });

  it('collects multiple distinct islands', () => {
    const root = new VNode('div');
    root.appendChild(makeIslandNode('counter', JSON.stringify({ start: 0 })));
    root.appendChild(makeIslandNode('search', JSON.stringify({ placeholder: 'Search...' })));

    const result = collectIslands(root);
    expect(result).toHaveLength(2);
    const names = result.map(i => i.name);
    expect(names).toContain('counter');
    expect(names).toContain('search');
  });

  it('collects islands nested deep in tree', () => {
    const root = new VNode('div');
    const section = new VNode('section');
    const article = new VNode('article');
    article.appendChild(makeIslandNode('deep-island', JSON.stringify({ x: 42 })));
    section.appendChild(article);
    root.appendChild(section);

    const result = collectIslands(root);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('deep-island');
  });

  it('ignores non-island elements', () => {
    const root = new VNode('div');
    const plain = new VNode('p');
    plain.setAttribute('class', 'text');
    root.appendChild(plain);

    const result = collectIslands(root);
    expect(result).toHaveLength(0);
  });

  it('handles malformed props JSON gracefully', () => {
    const root = new VNode('div');
    const node = new VNode('div');
    node.setAttribute('data-island', 'broken');
    node.setAttribute('data-island-props', 'not-valid-json{{{');
    root.appendChild(node);

    const result = collectIslands(root);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('broken');
    expect(result[0]!.props).toEqual({});
  });
});

describe('renderIslandPage', () => {
  it('generates valid HTML', () => {
    const html = renderIslandPage('<p>Hello</p>', []);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<title>DRISHTI App</title>');
    expect(html).toContain('<div id="app"><p>Hello</p></div>');
  });

  it('uses provided title and lang options', () => {
    const html = renderIslandPage('', [], { title: 'My App', lang: 'fr' });
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('<title>My App</title>');
  });

  it('includes hydration script when islands present', () => {
    const islands = [
      { name: 'counter', props: {}, count: 1 },
      { name: 'search', props: {}, count: 2 },
    ];
    const html = renderIslandPage('<div></div>', islands);
    expect(html).toContain('<script type="module">');
    expect(html).toContain(`import { hydrateIslands } from '@nexoraaidrishti/runtime';`);
    expect(html).toContain('// island: counter');
    expect(html).toContain('// island: search');
    expect(html).toContain('hydrateIslands();');
  });

  it('omits script when no islands', () => {
    const html = renderIslandPage('<p>Static</p>', []);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('hydrateIslands');
  });

  it('places content inside #app div', () => {
    const content = '<span data-island="foo">island</span>';
    const html = renderIslandPage(content, [{ name: 'foo', props: {}, count: 1 }]);
    expect(html).toContain(`<div id="app">${content}</div>`);
  });
});
