import { parseDrFile } from './parser.js';
import { compileTemplate } from './template-compiler.js';

export function transformDrFile(source: string, id: string): string {
  const blocks = parseDrFile(source);

  const parts: string[] = [];

  // Runtime import
  parts.push(`import { h, effect, signal, computed, batch, show, each } from '@drishti/runtime';`);

  // User script
  if (blocks.script) {
    // Remove any import of @drishti/runtime from user script (we provide it)
    const script = blocks.script.replace(
      /import\s+\{[^}]+\}\s+from\s+['"]@drishti\/runtime['"]\s*;?\n?/g,
      ''
    );
    parts.push(script);
  }

  // Compiled template
  if (blocks.template) {
    parts.push(compileTemplate(blocks.template, id));
  } else {
    parts.push(`export function render(): HTMLElement { return h('div', {}); }`);
  }

  // Style injection
  if (blocks.style) {
    const escaped = blocks.style.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    parts.push(`
// Style injection
if (typeof document !== 'undefined') {
  const __styleId = ${JSON.stringify(`dr-style-${id.replace(/[^a-z0-9]/gi, '-')}`)};
  if (!document.getElementById(__styleId)) {
    const __style = document.createElement('style');
    __style.id = __styleId;
    __style.textContent = \`${escaped}\`;
    document.head.appendChild(__style);
  }
}`);
  }

  // Default export: the render function
  parts.push(`export default render;`);

  return parts.join('\n\n');
}
