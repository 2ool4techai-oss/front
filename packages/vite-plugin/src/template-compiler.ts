export function compileTemplate(template: string, _id: string): string {
  const trimmed = template.trim();
  const compiled = transformNode(trimmed);
  return `export function render(): HTMLElement {\n  return ${compiled};\n}`;
}

function transformNode(html: string): string {
  html = html.trim();

  if (!html) return `''`;

  // Text node (no tags)
  if (!html.startsWith('<')) {
    return transformTextContent(html);
  }

  // Parse opening tag
  const tagMatch = html.match(/^<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?\s*\/?>/);
  if (!tagMatch) return `h('div', {})`;

  const tag = tagMatch[1]!;
  const attrsStr = tagMatch[2] ?? '';
  const selfClosing = html.match(/^<[^>]+\/>/) !== null;

  const attrs = parseAttrs(attrsStr);

  if (selfClosing) {
    return `h('${tag}', ${attrsToCode(attrs)})`;
  }

  // Find closing tag and extract children
  const openTagEnd = html.indexOf('>') + 1;
  const closeTag = `</${tag}>`;
  const closeIdx = html.lastIndexOf(closeTag);

  if (closeIdx < 0) return `h('${tag}', ${attrsToCode(attrs)})`;

  const innerHtml = html.slice(openTagEnd, closeIdx).trim();
  const children = splitChildren(innerHtml);

  const compiledChildren = children
    .map(c => transformNode(c.trim()))
    .filter(Boolean)
    .join(', ');

  return `h('${tag}', ${attrsToCode(attrs)}${compiledChildren ? ', ' + compiledChildren : ''})`;
}

/**
 * Extract a balanced-brace expression starting at `start` (the `{`).
 * Returns [innerContent, endIndex] where endIndex is the position after the closing `}`.
 */
function extractBraceExpr(s: string, start: number): [string, number] {
  let depth = 0;
  let i = start;
  let inner = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === '{') { depth++; if (depth > 1) inner += ch; }
    else if (ch === '}') { depth--; if (depth === 0) { i++; break; } else inner += ch; }
    else if (depth > 0) inner += ch;
    i++;
  }
  return [inner, i];
}

function parseAttrs(attrsStr: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (!attrsStr.trim()) return attrs;

  // attr="value" → static (extract first, won't conflict with brace attrs)
  const staticRe = /([a-zA-Z-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = staticRe.exec(attrsStr)) !== null) {
    attrs[match[1]!] = match[2]!;
  }

  // attr={expr} and on:event={expr} — use balanced-brace extraction
  const attrNameRe = /([a-zA-Z][a-zA-Z0-9:.-]*)=\{/g;
  while ((match = attrNameRe.exec(attrsStr)) !== null) {
    const fullName = match[1]!;
    const braceStart = match.index + match[0].length - 1; // position of `{`
    const [inner] = extractBraceExpr(attrsStr, braceStart);
    if (fullName.startsWith('on:')) {
      const eventName = fullName.slice(3); // strip "on:"
      attrs[`on${eventName}`] = `__EVENT__${inner}`;
    } else {
      attrs[fullName] = `__SIGNAL__${inner}`;
    }
  }

  return attrs;
}

function attrsToCode(attrs: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'string' && v.startsWith('__EVENT__')) {
      parts.push(`'${k}': ${v.slice('__EVENT__'.length)}`);
    } else if (typeof v === 'string' && v.startsWith('__SIGNAL__')) {
      parts.push(`'${k}': () => ${v.slice('__SIGNAL__'.length)}`);
    } else {
      parts.push(`'${k}': ${JSON.stringify(v)}`);
    }
  }
  return `{ ${parts.join(', ')} }`;
}

function transformTextContent(text: string): string {
  if (text.includes('{') && text.includes('}')) {
    // Replace {expr} with signal accessor
    const transformed = text.replace(/\{([^}]+)\}/g, '${$1}');
    return `() => \`${transformed}\``;
  }
  return JSON.stringify(text);
}

function splitChildren(html: string): string[] {
  const children: string[] = [];
  let i = 0;
  let current = '';
  let depth = 0;

  while (i < html.length) {
    if (html[i] === '<') {
      if (html[i + 1] === '/') {
        depth--;
        const end = html.indexOf('>', i) + 1;
        current += html.slice(i, end);
        i = end;
        if (depth === 0) {
          if (current.trim()) children.push(current.trim());
          current = '';
        }
      } else {
        if (depth === 0 && current.trim()) {
          children.push(current.trim());
          current = '';
        }
        depth++;
        const end = html.indexOf('>', i) + 1;
        current += html.slice(i, end);
        i = end;
        if (html.slice(i - 2, i) === '/>') depth--;
      }
    } else {
      current += html[i];
      i++;
    }
  }
  if (current.trim()) children.push(current.trim());
  return children.filter(c => c.trim());
}
