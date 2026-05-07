import { VNode } from './vdom.js';

export interface ServerIslandInfo {
  name:  string;
  props: Record<string, unknown>;
  count: number;
}

/** Walk a VNode tree and collect all islands present */
export function collectIslands(root: VNode): ServerIslandInfo[] {
  const map = new Map<string, ServerIslandInfo>();

  function walk(node: VNode): void {
    if (node.nodeType === 1) {
      const name = node.getAttribute('data-island');
      if (name) {
        let propsRaw: Record<string, unknown> = {};
        try { propsRaw = JSON.parse(node.getAttribute('data-island-props') ?? '{}') as Record<string, unknown>; } catch {}
        const existing = map.get(name);
        if (existing) { existing.count++; }
        else { map.set(name, { name, props: propsRaw, count: 1 }); }
      }
      for (const child of (node as unknown as { childNodes: VNode[] }).childNodes ?? []) {
        walk(child);
      }
    }
  }

  walk(root);
  return [...map.values()];
}

/** Render a page with islands — returns HTML + minimal bootstrap script */
export function renderIslandPage(
  html:         string,
  islands:      ServerIslandInfo[],
  options:      { title?: string; lang?: string } = {},
): string {
  const islandNames = islands.map(i => i.name);
  const bootstrap   = islandNames.length
    ? `<script type="module">\nimport { hydrateIslands } from '@drishti/runtime';\n${islandNames.map(n => `// island: ${n}`).join('\n')}\nhydrateIslands();\n</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="${options.lang ?? 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title ?? 'DRISHTI App'}</title>
</head>
<body>
  <div id="app">${html}</div>
  ${bootstrap}
</body>
</html>`;
}
