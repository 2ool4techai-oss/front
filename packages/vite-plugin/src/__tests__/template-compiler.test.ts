import { describe, it, expect } from 'vitest';
import { compileTemplate } from '../template-compiler.js';

describe('compileTemplate', () => {
  it('wraps output in render function', () => {
    const result = compileTemplate('<div></div>', 'test');
    expect(result).toContain('export function render()');
  });

  it('generates h() call for element', () => {
    const result = compileTemplate('<div></div>', 'test');
    expect(result).toContain("h('div'");
  });

  it('includes static class attr', () => {
    const result = compileTemplate('<div class="foo"></div>', 'test');
    expect(result).toContain('foo');
  });

  it('handles text content', () => {
    const result = compileTemplate('<div>hello world</div>', 'test');
    expect(result).toContain('hello world');
  });

  it('handles dynamic expression in text', () => {
    const result = compileTemplate('<span>{count()}</span>', 'test');
    expect(result).toContain('count()');
  });

  it('handles event binding', () => {
    const result = compileTemplate('<button on:click={handleClick}>ok</button>', 'test');
    expect(result).toContain('handleClick');
    expect(result).toContain('onclick');
  });

  it('handles nested elements', () => {
    const result = compileTemplate('<div><span>hi</span></div>', 'test');
    expect(result).toContain("h('span'");
    expect(result).toContain("h('div'");
  });

  it('handles self-closing tags', () => {
    const result = compileTemplate('<input />', 'test');
    expect(result).toContain("h('input'");
  });

  it('handles multiple children', () => {
    const result = compileTemplate('<div><span>a</span><span>b</span></div>', 'test');
    const spanCount = (result.match(/h\('span'/g) || []).length;
    expect(spanCount).toBe(2);
  });

  it('handles dynamic attribute binding', () => {
    const result = compileTemplate('<input value={myVal} />', 'test');
    expect(result).toContain('myVal');
    expect(result).toContain('=>');
  });

  it('wraps dynamic text in arrow function', () => {
    const result = compileTemplate('<span>{x + 1}</span>', 'test');
    expect(result).toContain('=>');
    expect(result).toContain('x + 1');
  });

  it('outputs static string for plain text', () => {
    const result = compileTemplate('<p>static text</p>', 'test');
    expect(result).toContain('"static text"');
  });

  it('handles inline event handler arrow function', () => {
    const result = compileTemplate('<button on:click={() => doSomething()}>click</button>', 'test');
    expect(result).toContain('doSomething()');
    expect(result).toContain('onclick');
  });

  it('generates return statement', () => {
    const result = compileTemplate('<div></div>', 'test');
    expect(result).toContain('return ');
  });
});
