import { describe, it, expect } from 'vitest';
import { renderToString, registerSSRState, useSSRState, createSSRContext } from '../index.js';
import { VNode, VTextNode } from '../vdom.js';

describe('renderToString', () => {
  it('renders a VNode to HTML string', () => {
    const ctx = createSSRContext();
    const el = ctx.document.createElement('div');
    el.setAttribute('class', 'app');
    el.appendChild(ctx.document.createTextNode('Hello SSR'));

    const { html } = renderToString(() => el, ctx);
    expect(html).toContain('Hello SSR');
    expect(html).toContain('class="app"');
  });

  it('returns empty html for non-VNode factory result', () => {
    const { html } = renderToString(() => null);
    expect(html).toBe('');
  });

  it('returns stateScript when state is registered', () => {
    registerSSRState('user', { id: 1, name: 'Alice' });
    const { stateScript, state } = renderToString(() => null);
    expect(stateScript).toContain('<script>');
    expect(stateScript).toContain('__DRISHTI_STATE__');
    expect(state['user']).toEqual({ id: 1, name: 'Alice' });
  });

  it('clears state registry between renders', () => {
    registerSSRState('key', 'value1');
    renderToString(() => null); // consumes registry
    const { state } = renderToString(() => null);
    expect(Object.keys(state)).toHaveLength(0);
  });

  it('restores global document/window after render', () => {
    const origDoc = (globalThis as Record<string, unknown>)['document'];
    renderToString(() => null);
    expect((globalThis as Record<string, unknown>)['document']).toBe(origDoc);
  });
});

describe('VNode serialization', () => {
  it('serializes element with attributes and text', () => {
    const ctx = createSSRContext();
    const p = ctx.document.createElement('p');
    p.setAttribute('id', 'test');
    p.appendChild(ctx.document.createTextNode('content'));
    expect((p as unknown as VNode).serialize()).toBe('<p id="test">content</p>');
  });

  it('serializes void elements without closing slash', () => {
    const ctx = createSSRContext();
    const img = ctx.document.createElement('img');
    img.setAttribute('src', '/logo.png');
    img.setAttribute('alt', 'logo');
    const html = (img as unknown as VNode).serialize();
    expect(html).toContain('<img');
    expect(html).toContain('src="/logo.png"');
    expect(html).toContain('alt="logo"');
    expect(html).not.toContain('</img>');
  });

  it('escapes text content', () => {
    const ctx = createSSRContext();
    const span = ctx.document.createElement('span');
    span.appendChild(ctx.document.createTextNode('<script>alert(1)</script>'));
    const html = (span as unknown as VNode).serialize();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('nests children correctly', () => {
    const ctx = createSSRContext();
    const ul = ctx.document.createElement('ul');
    const li1 = ctx.document.createElement('li');
    li1.appendChild(ctx.document.createTextNode('Item 1'));
    const li2 = ctx.document.createElement('li');
    li2.appendChild(ctx.document.createTextNode('Item 2'));
    ul.appendChild(li1);
    ul.appendChild(li2);
    const html = (ul as unknown as VNode).serialize();
    expect(html).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('serializes textContent set directly', () => {
    const ctx = createSSRContext();
    const div = ctx.document.createElement('div');
    div.textContent = 'direct text';
    expect((div as unknown as VNode).serialize()).toBe('<div>direct text</div>');
  });

  it('VTextNode serializes and escapes HTML', () => {
    const tn = new VTextNode('hello & world');
    expect(tn.serialize()).toBe('hello &amp; world');
  });
});

describe('useSSRState', () => {
  it('returns fallback when window is undefined', () => {
    const result = useSSRState('missing', 42);
    expect(result).toBe(42);
  });
});
