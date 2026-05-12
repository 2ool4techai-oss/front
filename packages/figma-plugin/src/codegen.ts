import type { DrNode } from './serializer.js';

export interface CodegenOptions {
  componentName?: string;
  addSignals?:    boolean;  // scaffold reactive signals for text content
}

export function generateDrFile(root: DrNode, opts?: CodegenOptions): string {
  const name = opts?.componentName ?? toPascalCase(root.name);
  const addSignals = opts?.addSignals ?? false;

  // Collect text nodes for signal scaffolding
  const textNodes: string[] = [];
  if (addSignals) collectTextNodes(root, textNodes);

  const scriptLines: string[] = [
    `import { signal, computed } from '@nexoraaidrishti/runtime';`,
  ];

  if (addSignals && textNodes.length > 0) {
    for (const t of textNodes) {
      const varName = toCamelCase(t.slice(0, 20));
      scriptLines.push(`const ${varName} = signal(${JSON.stringify(t)});`);
    }
  }

  const templateHtml = renderDrNode(root, 0);
  const css = collectCSS(root);

  const parts: string[] = [];
  parts.push(`<script>\n${scriptLines.join('\n')}\n</script>`);
  parts.push(`<template>\n${templateHtml}\n</template>`);
  if (css.trim()) parts.push(`<style>\n${css}\n</style>`);

  return `<!-- ${name}.dr — exported from Figma by DRISHTI Exporter -->\n${parts.join('\n\n')}`;
}

function renderDrNode(node: DrNode, depth: number): string {
  const indent = '  '.repeat(depth + 1);
  const styleStr = Object.entries(node.style)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  const attrs: string[] = [];
  if (styleStr) attrs.push(`style="${styleStr}"`);
  if (node.attrs['class']) attrs.push(`class="${node.attrs['class']}"`);
  for (const [k, v] of Object.entries(node.attrs)) {
    if (k === 'class' || k === 'style') continue;
    attrs.push(v ? `${k}="${v}"` : k);
  }

  const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';

  if (node.type === 'image') {
    return `${indent}<img${attrStr} />`;
  }

  if (node.type === 'text') {
    return `${indent}<${node.tag}${attrStr}>${node.text ?? ''}</${node.tag}>`;
  }

  if (node.children.length === 0) {
    return `${indent}<${node.tag}${attrStr}></${node.tag}>`;
  }

  const childrenStr = node.children.map(c => renderDrNode(c, depth + 1)).join('\n');
  return `${indent}<${node.tag}${attrStr}>\n${childrenStr}\n${indent}</${node.tag}>`;
}

function collectCSS(node: DrNode): string {
  // Generate class-based CSS from node names
  const rules: string[] = [];
  collectCSSRules(node, rules);
  return rules.join('\n');
}

function collectCSSRules(node: DrNode, rules: string[]): void {
  if (Object.keys(node.style).length > 0) {
    const className = toKebabCase(node.name);
    const props = Object.entries(node.style).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    rules.push(`.${className} {\n${props}\n}`);
  }
  for (const child of node.children) collectCSSRules(child, rules);
}

function collectTextNodes(node: DrNode, texts: string[]): void {
  if (node.type === 'text' && node.text) texts.push(node.text);
  for (const c of node.children) collectTextNodes(c, texts);
}

function toPascalCase(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
          .replace(/^(.)/, (c: string) => c.toUpperCase());
}

function toCamelCase(s: string): string {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
