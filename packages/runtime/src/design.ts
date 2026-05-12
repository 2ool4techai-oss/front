// ── Types ──────────────────────────────────────────────────────────────

export interface DesignToken {
  type: 'color' | 'spacing' | 'typography' | 'border' | 'shadow';
  name: string;
  value: string;
  cssVar?: string;
}

export interface DesignComponent {
  name: string;
  tokens: DesignToken[];
  html: string;           // structural HTML template
  signals: string[];      // suggested signal names
  code: string;           // generated DRISHTI component code
}

// ── CSS variable naming ────────────────────────────────────────────────

function tokenToCssVar(token: DesignToken): string {
  if (token.cssVar) return token.cssVar;
  // Convert "Primary Color" → "--dr-primary-color"
  const slug = token.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `--dr-${token.type}-${slug}`;
}

// ── fromDesignTokens ───────────────────────────────────────────────────

/**
 * Convert a set of design tokens to a flat Record of CSS custom properties.
 * e.g. { '--dr-color-primary': '#3b82f6', '--dr-spacing-md': '16px' }
 */
export function fromDesignTokens(tokens: DesignToken[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const token of tokens) {
    result[tokenToCssVar(token)] = token.value;
  }
  return result;
}

// ── injectDesignSystem ─────────────────────────────────────────────────

/**
 * Inject all design tokens as CSS custom properties on :root.
 * Safe to call multiple times — reuses or creates a <style id="dr-design-system">.
 */
export function injectDesignSystem(tokens: DesignToken[]): void {
  if (typeof document === 'undefined') return;

  const cssVars = fromDesignTokens(tokens);
  const declarations = Object.entries(cssVars)
    .map(([prop, val]) => `  ${prop}: ${val};`)
    .join('\n');

  const css = `:root {\n${declarations}\n}`;

  const existingStyle = document.getElementById('dr-design-system') as HTMLStyleElement | null;
  if (existingStyle) {
    existingStyle.textContent = css;
  } else {
    const style = document.createElement('style');
    style.id = 'dr-design-system';
    style.textContent = css;
    document.head.appendChild(style);
  }
}

// ── parseDesignSpec ────────────────────────────────────────────────────

interface FigmaLikeNode {
  name?: string;
  type?: string;
  fills?: Array<{ color?: { r: number; g: number; b: number; a?: number } }>;
  strokes?: Array<{ color?: { r: number; g: number; b: number } }>;
  cornerRadius?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  effects?: Array<{ type?: string; radius?: number; color?: { r: number; g: number; b: number; a?: number } }>;
  children?: FigmaLikeNode[];
  // Generic spec properties
  [key: string]: unknown;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractTokensFromNode(node: FigmaLikeNode, tokens: DesignToken[]): void {
  const name = node.name ?? 'unnamed';

  // Colors from fills
  if (node.fills?.length) {
    for (const fill of node.fills) {
      if (fill.color) {
        const { r, g, b, a = 1 } = fill.color;
        const hex = rgbToHex(r, g, b);
        const value = a < 1 ? `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}` : hex;
        tokens.push({ type: 'color', name: `${name} fill`, value });
      }
    }
  }

  // Spacing from padding
  if (node.paddingTop !== undefined) {
    const p = node.paddingTop;
    tokens.push({ type: 'spacing', name: `${name} padding top`, value: `${p}px` });
  }
  if (node.itemSpacing !== undefined) {
    tokens.push({ type: 'spacing', name: `${name} gap`, value: `${node.itemSpacing}px` });
  }

  // Typography
  if (node.fontSize !== undefined) {
    tokens.push({ type: 'typography', name: `${name} font size`, value: `${node.fontSize}px` });
  }
  if (node.fontFamily) {
    tokens.push({ type: 'typography', name: `${name} font family`, value: String(node.fontFamily) });
  }

  // Border
  if (node.cornerRadius !== undefined) {
    tokens.push({ type: 'border', name: `${name} radius`, value: `${node.cornerRadius}px` });
  }

  // Shadow effects
  if (node.effects?.length) {
    for (const effect of node.effects) {
      if ((effect.type === 'DROP_SHADOW' || effect.type === 'shadow') && effect.color) {
        const { r, g, b, a = 0.3 } = effect.color;
        const radius = effect.radius ?? 4;
        tokens.push({
          type: 'shadow',
          name: `${name} shadow`,
          value: `0 2px ${radius}px rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a.toFixed(2)})`,
        });
      }
    }
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      extractTokensFromNode(child, tokens);
    }
  }
}

function inferComponentType(spec: FigmaLikeNode): string {
  const name = (spec.name ?? '').toLowerCase();
  if (name.includes('button') || name.includes('btn'))  return 'button';
  if (name.includes('card'))                            return 'card';
  if (name.includes('input') || name.includes('field')) return 'input';
  if (name.includes('modal') || name.includes('dialog')) return 'modal';
  if (name.includes('nav') || name.includes('menu'))    return 'nav';
  if (name.includes('form'))                            return 'form';
  if (name.includes('list'))                            return 'list';
  if (name.includes('header'))                          return 'header';
  return 'component';
}

function buildHtml(componentType: string, name: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  switch (componentType) {
    case 'button':
      return `<button class="${slug}" type="button">\n  <span class="${slug}__label">Label</span>\n</button>`;
    case 'card':
      return `<article class="${slug}">\n  <header class="${slug}__header">\n    <h3 class="${slug}__title">Title</h3>\n  </header>\n  <div class="${slug}__body">Content</div>\n  <footer class="${slug}__footer"></footer>\n</article>`;
    case 'input':
      return `<div class="${slug}">\n  <label class="${slug}__label" for="${slug}-input">Label</label>\n  <input class="${slug}__input" id="${slug}-input" type="text" />\n</div>`;
    case 'modal':
      return `<div class="${slug}" role="dialog" aria-modal="true" aria-labelledby="${slug}-title">\n  <div class="${slug}__backdrop"></div>\n  <div class="${slug}__panel">\n    <h2 id="${slug}-title" class="${slug}__title">Title</h2>\n    <div class="${slug}__body">Content</div>\n    <footer class="${slug}__footer"></footer>\n  </div>\n</div>`;
    case 'nav':
      return `<nav class="${slug}" aria-label="Main navigation">\n  <ul class="${slug}__list">\n    <li class="${slug}__item"><a href="/" class="${slug}__link">Home</a></li>\n  </ul>\n</nav>`;
    case 'form':
      return `<form class="${slug}">\n  <fieldset class="${slug}__fields">\n    <div class="${slug}__field">\n      <label for="${slug}-name">Name</label>\n      <input id="${slug}-name" type="text" name="name" />\n    </div>\n  </fieldset>\n  <footer class="${slug}__actions">\n    <button type="submit">Submit</button>\n  </footer>\n</form>`;
    default:
      return `<div class="${slug}">\n  <!-- ${name} content -->\n</div>`;
  }
}

function buildSignalNames(componentType: string, _name: string): string[] {
  switch (componentType) {
    case 'button':  return ['isLoading', 'isDisabled', 'label'];
    case 'card':    return ['title', 'body', 'isExpanded', 'isSelected'];
    case 'input':   return ['value', 'error', 'isFocused', 'isDisabled'];
    case 'modal':   return ['isOpen', 'title', 'onConfirm'];
    case 'nav':     return ['activeRoute', 'isCollapsed', 'items'];
    case 'form':    return ['formData', 'errors', 'isSubmitting', 'isValid'];
    default:        return ['isVisible', 'data', 'isLoading'];
  }
}

function buildCode(name: string, componentType: string, tokens: DesignToken[], signals: string[]): string {
  const cssVars = fromDesignTokens(tokens);
  const cssVarLines = Object.entries(cssVars)
    .map(([prop, val]) => `  '${prop}': '${val}',`)
    .join('\n');

  const signalDecls = signals.map(s => `  const ${s} = signal(/* initial value */);`).join('\n');
  const slug = name.toLowerCase().replace(/\s+/g, '-');

  return `import { signal, effect } from '@drishti/runtime';

// Design tokens for ${name}
const tokens = {
${cssVarLines}
};

// Component: ${name}
export function create${name.replace(/\s+/g, '')}(): HTMLElement {
${signalDecls}

  const el = document.createElement('div');
  el.className = '${slug}';

  // Apply design tokens as CSS variables
  Object.entries(tokens).forEach(([prop, val]) => {
    el.style.setProperty(prop, val);
  });

  // Render
  function render() {
    // Update el based on signals here
  }

  effect(render);

  return el;
}`;
}

export function parseDesignSpec(spec: object): DesignComponent {
  const node      = spec as FigmaLikeNode;
  const name      = node.name ?? 'Component';
  const tokens: DesignToken[] = [];

  extractTokensFromNode(node, tokens);

  const componentType = inferComponentType(node);
  const html          = buildHtml(componentType, name);
  const signals       = buildSignalNames(componentType, name);
  const code          = buildCode(name, componentType, tokens, signals);

  return {
    name,
    tokens,
    html,
    signals,
    code,
  };
}
