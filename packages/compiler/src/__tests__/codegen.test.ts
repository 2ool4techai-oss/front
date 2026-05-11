import { describe, it, expect } from 'vitest';
import { generateDirectDOM } from '../codegen.js';
import type { DOMASTNode as ASTNode } from '../codegen.js';

describe('generateDirectDOM', () => {
  it('generates code for a simple element', () => {
    const ast: ASTNode = { type: 'element', tag: 'div', attrs: {}, children: [] };
    const result = generateDirectDOM(ast);
    expect(result.code).toContain("createElement('div')");
  });

  it('generates code for a text node', () => {
    const ast: ASTNode = { type: 'text', value: 'hello' };
    const result = generateDirectDOM(ast);
    expect(result.code).toContain("createTextNode");
    expect(result.code).toContain('hello');
  });

  it('generates event listener for on:click', () => {
    const ast: ASTNode = {
      type: 'element',
      tag: 'button',
      attrs: { 'on:click': { type: 'event', value: 'handleClick' } },
      children: [],
    };
    const result = generateDirectDOM(ast);
    expect(result.code).toContain('addEventListener');
    expect(result.code).toContain('click');
  });

  it('generates effect for signal attr', () => {
    const ast: ASTNode = {
      type: 'element',
      tag: 'div',
      attrs: { class: { type: 'signal', value: 'className' } },
      children: [],
    };
    const result = generateDirectDOM(ast);
    expect(result.code).toContain('effect');
    expect(result.code).toContain('className');
  });

  it('generates appendChild for children', () => {
    const ast: ASTNode = {
      type: 'element',
      tag: 'div',
      attrs: {},
      children: [
        { type: 'element', tag: 'span', attrs: {}, children: [] },
      ],
    };
    const result = generateDirectDOM(ast);
    expect(result.code).toContain('appendChild');
  });

  it('returns imports array', () => {
    const ast: ASTNode = { type: 'element', tag: 'div', attrs: {}, children: [] };
    const result = generateDirectDOM(ast);
    expect(Array.isArray(result.imports)).toBe(true);
  });

  it('returns exports array', () => {
    const ast: ASTNode = { type: 'element', tag: 'div', attrs: {}, children: [] };
    const result = generateDirectDOM(ast);
    expect(Array.isArray(result.exports)).toBe(true);
  });

  it('handles nested elements', () => {
    const ast: ASTNode = {
      type: 'element',
      tag: 'ul',
      attrs: {},
      children: [
        { type: 'element', tag: 'li', attrs: {}, children: [{ type: 'text', value: 'item' }] },
        { type: 'element', tag: 'li', attrs: {}, children: [{ type: 'text', value: 'item2' }] },
      ],
    };
    const result = generateDirectDOM(ast);
    expect(result.code).toContain("createElement('li')");
  });

  it('static string attr sets attribute directly', () => {
    const ast: ASTNode = {
      type: 'element',
      tag: 'input',
      attrs: { type: 'text', placeholder: 'Enter name' },
      children: [],
    };
    const result = generateDirectDOM(ast);
    expect(result.code).toContain('setAttribute');
    expect(result.code).toContain('placeholder');
  });
});
