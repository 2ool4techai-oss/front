// ── Visual Regression Testing ─────────────────────────────────────────

export interface VisualSnapshot {
  id:        string;
  name:      string;
  timestamp: number;
  html:      string;
  styles:    string;
  width:     number;
  height:    number;
}

export interface VisualDiff {
  changed:         boolean;
  additions:       string[];
  removals:        string[];
  textChanges:     Array<{ path: string; before: string; after: string }>;
  structureChanged: boolean;
}

export interface VisualOptions {
  threshold?: number;
  ignore?:    string[];
}

export function takeSnapshot(el: HTMLElement, name: string): VisualSnapshot {
  const rect    = el.getBoundingClientRect();
  const html    = el.outerHTML;
  let styles = '';
  try {
    const computed = window.getComputedStyle(el);
    styles = computed.cssText ?? '';
  } catch {
    styles = '';
  }

  return {
    id:        Math.random().toString(36).slice(2),
    name,
    timestamp: Date.now(),
    html,
    styles,
    width:     rect.width,
    height:    rect.height,
  };
}

/** Extract class tokens from an HTML string */
function extractClasses(html: string): Set<string> {
  const classes = new Set<string>();
  const re = /class="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    for (const cls of (match[1] ?? '').split(/\s+/)) {
      if (cls) classes.add(cls);
    }
  }
  return classes;
}

/** Extract text nodes (simple heuristic: text between tags) */
function extractTextNodes(html: string): string[] {
  return html
    .replace(/<[^>]+>/g, '\x00')
    .split('\x00')
    .map(s => s.trim())
    .filter(Boolean);
}

export function diffSnapshots(
  before: VisualSnapshot,
  after: VisualSnapshot,
  opts?: VisualOptions,
): VisualDiff {
  const structureChanged = before.html !== after.html;

  if (!structureChanged) {
    return {
      changed: false,
      additions: [],
      removals: [],
      textChanges: [],
      structureChanged: false,
    };
  }

  const beforeClasses = extractClasses(before.html);
  const afterClasses  = extractClasses(after.html);

  const additions: string[] = [];
  const removals:  string[] = [];

  for (const cls of afterClasses) {
    if (!beforeClasses.has(cls)) additions.push(cls);
  }
  for (const cls of beforeClasses) {
    if (!afterClasses.has(cls)) removals.push(cls);
  }

  // Text changes
  const beforeTexts = extractTextNodes(before.html);
  const afterTexts  = extractTextNodes(after.html);
  const textChanges: Array<{ path: string; before: string; after: string }> = [];

  const maxLen = Math.max(beforeTexts.length, afterTexts.length);
  for (let i = 0; i < maxLen; i++) {
    const bText = beforeTexts[i] ?? '';
    const aText = afterTexts[i] ?? '';
    if (bText !== aText) {
      textChanges.push({ path: `text[${i}]`, before: bText, after: aText });
    }
  }

  // Apply ignore selectors (best-effort: filter matching class additions/removals)
  if (opts?.ignore != null && opts.ignore.length > 0) {
    // Simple heuristic: ignore class-based selectors
    for (const sel of opts.ignore) {
      const classMatch = sel.match(/^\.(.+)$/);
      if (classMatch) {
        const cls = classMatch[1] ?? '';
        const ai = additions.indexOf(cls);
        if (ai >= 0) additions.splice(ai, 1);
        const ri = removals.indexOf(cls);
        if (ri >= 0) removals.splice(ri, 1);
      }
    }
  }

  const changed = structureChanged || additions.length > 0 || removals.length > 0 || textChanges.length > 0;

  return {
    changed,
    additions,
    removals,
    textChanges,
    structureChanged,
  };
}

export function assertVisualMatch(
  el: HTMLElement,
  baseline: VisualSnapshot,
  opts?: VisualOptions,
): void {
  const current = takeSnapshot(el, baseline.name);
  const diff    = diffSnapshots(baseline, current, opts);
  const threshold = opts?.threshold ?? 0;

  if (!diff.changed) return;

  if (threshold === 0) {
    throw new Error(
      `Visual regression detected for "${baseline.name}":\n` +
      `  Structure changed: ${diff.structureChanged}\n` +
      `  Additions: ${diff.additions.join(', ') || 'none'}\n` +
      `  Removals:  ${diff.removals.join(', ') || 'none'}\n` +
      `  Text changes: ${diff.textChanges.length}`,
    );
  }

  // Calculate change ratio
  const totalClasses = new Set([...extractClasses(baseline.html), ...extractClasses(current.html)]).size;
  const changedCount = diff.additions.length + diff.removals.length;
  const ratio = totalClasses === 0 ? 1 : changedCount / totalClasses;

  if (ratio > threshold) {
    throw new Error(
      `Visual regression detected for "${baseline.name}" (ratio=${ratio.toFixed(3)}, threshold=${threshold}):\n` +
      `  Additions: ${diff.additions.join(', ') || 'none'}\n` +
      `  Removals:  ${diff.removals.join(', ') || 'none'}`,
    );
  }
}

export function setupVisualMatchers(): void {
  const globalExpect = (globalThis as Record<string, unknown>)['expect'] as
    | ({ extend: (matchers: Record<string, unknown>) => void } & Record<string, unknown>)
    | undefined;

  if (globalExpect != null && 'extend' in globalExpect) {
    globalExpect.extend({
      toMatchVisualSnapshot(received: HTMLElement, baseline: VisualSnapshot, opts?: VisualOptions) {
        try {
          assertVisualMatch(received, baseline, opts);
          return { pass: true, message: () => `Expected element NOT to match visual snapshot "${baseline.name}"` };
        } catch (err) {
          return {
            pass: false,
            message: () => err instanceof Error ? err.message : String(err),
          };
        }
      },
    });
  }
}
