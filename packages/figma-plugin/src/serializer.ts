import type { FigmaNode, FigmaColor } from './types.js';

export interface DrNode {
  type:     'container' | 'text' | 'image' | 'shape';
  tag:      string;
  name:     string;
  attrs:    Record<string, string>;
  style:    Record<string, string>;
  children: DrNode[];
  text?:    string;
}

function colorToCSS(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  if (color.a < 1) return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`;
  return `rgb(${r}, ${g}, ${b})`;
}

function extractFill(node: FigmaNode): string | undefined {
  const fill = node.fills?.[0];
  if (!fill || fill.type !== 'SOLID' || !fill.color) return undefined;
  const color = { ...fill.color, a: (fill.color.a ?? 1) * (fill.opacity ?? 1) };
  return colorToCSS(color);
}

function layoutStyles(node: FigmaNode): Record<string, string> {
  const style: Record<string, string> = {};

  if (node.width !== undefined)  style['width']  = `${node.width}px`;
  if (node.height !== undefined) style['height'] = `${node.height}px`;
  if (node.opacity !== undefined && node.opacity < 1) style['opacity'] = node.opacity.toFixed(2);
  if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
    style['border-radius'] = `${node.cornerRadius}px`;
  }

  const fill = extractFill(node);
  if (fill) style['background-color'] = fill;

  if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
    style['display'] = 'flex';
    style['flex-direction'] = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
    if (node.itemSpacing !== undefined && node.itemSpacing > 0) {
      style['gap'] = `${node.itemSpacing}px`;
    }
    const pt = node.paddingTop    ?? 0;
    const pr = node.paddingRight  ?? 0;
    const pb = node.paddingBottom ?? 0;
    const pl = node.paddingLeft   ?? 0;
    if (pt || pr || pb || pl) {
      style['padding'] = `${pt}px ${pr}px ${pb}px ${pl}px`;
    }
  }

  if (node.strokes?.[0]?.color && node.strokeWeight) {
    const stroke = node.strokes[0];
    if (stroke.color) {
      style['border'] = `${node.strokeWeight}px solid ${colorToCSS(stroke.color)}`;
    }
  }

  return style;
}

export function serializeNode(node: FigmaNode): DrNode {
  if (!node.visible && node.visible !== undefined) {
    return { type: 'container', tag: 'div', name: node.name, attrs: { hidden: '' }, style: {}, children: [] };
  }

  if (node.type === 'TEXT') {
    const style: Record<string, string> = {};
    if (node.fontSize) style['font-size'] = `${node.fontSize}px`;
    if (node.fontWeight) style['font-weight'] = String(node.fontWeight);
    const fill = extractFill(node);
    if (fill) style['color'] = fill;
    return {
      type:     'text',
      tag:      'span',
      name:     node.name,
      attrs:    {},
      style,
      children: [],
      text:     node.characters ?? '',
    };
  }

  if (node.type === 'ELLIPSE') {
    const style = layoutStyles(node);
    style['border-radius'] = '50%';
    return { type: 'shape', tag: 'div', name: node.name, attrs: {}, style, children: [] };
  }

  if (node.type === 'IMAGE') {
    const style = layoutStyles(node);
    return {
      type:     'image',
      tag:      'img',
      name:     node.name,
      attrs:    { src: '', alt: node.name },
      style,
      children: [],
    };
  }

  // FRAME, COMPONENT, INSTANCE, GROUP, RECTANGLE
  const style = layoutStyles(node);
  const children = (node.children ?? [])
    .map(c => serializeNode(c));

  return {
    type:     'container',
    tag:      'div',
    name:     node.name,
    attrs:    {},
    style,
    children,
  };
}
