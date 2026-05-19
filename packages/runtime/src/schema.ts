import { signal } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface ScreenSchema {
  version: string;
  timestamp: number;
  route?: string;
  signals: Array<{
    id: string;
    label?: string;
    value: unknown;
    type: string;
    meta?: object;
  }>;
  dom?: string;           // compact DOM representation
  interactions?: string[]; // available user actions
}

// ── Signal registry for schema capture ────────────────────────────────

interface SchemaSignalEntry {
  id: string;
  label?: string;
  signal: Signal<unknown>;
  meta?: object;
}

const _schemaRegistry: SchemaSignalEntry[] = [];

/**
 * Register a signal so it appears in captureScreenSchema() output.
 * Returns the signal unchanged for chaining.
 */
export function registerSchemaSignal<T>(
  sig: Signal<T>,
  id: string,
  label?: string,
  meta?: object,
): Signal<T> {
  // Avoid duplicate registrations
  if (!_schemaRegistry.find(e => e.id === id)) {
    _schemaRegistry.push({ id, ...(label !== undefined ? { label } : {}), signal: sig as Signal<unknown>, ...(meta !== undefined ? { meta } : {}) });
  }
  return sig;
}

export function _clearSchemaRegistry(): void {
  _schemaRegistry.length = 0;
}

// ── DOM helpers ────────────────────────────────────────────────────────

function compactDOM(root: Element, depth = 0, maxDepth = 4): string {
  if (depth > maxDepth) return '…';

  const tag   = root.tagName.toLowerCase();
  const id    = root.id    ? `#${root.id}`    : '';
  const cls   = root.className && typeof root.className === 'string'
    ? `.${root.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';
  const role  = root.getAttribute('role')       ? `[role=${root.getAttribute('role')}]` : '';
  const ariaL = root.getAttribute('aria-label') ? `[aria-label]` : '';

  let text = '';
  if (root.childNodes.length > 0) {
    // Include meaningful text content (first 40 chars)
    const rawText = (root as HTMLElement).innerText ?? root.textContent ?? '';
    const snippet = rawText.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (snippet && root.children.length === 0) {
      text = `:"${snippet}"`;
    }
  }

  const selfTag = `${tag}${id}${cls}${role}${ariaL}${text}`;

  if (root.children.length === 0) return selfTag;

  const children = Array.from(root.children)
    .slice(0, 8) // cap children to keep output compact
    .map(c => compactDOM(c, depth + 1, maxDepth))
    .join(', ');

  return `${selfTag}(${children})`;
}

function getInteractions(): string[] {
  if (typeof document === 'undefined') return [];

  const actions: string[] = [];

  // Buttons
  document.querySelectorAll('button:not([disabled])').forEach(btn => {
    const text = ((btn as HTMLElement).textContent ?? '').trim().slice(0, 30);
    const id   = btn.id;
    actions.push(id ? `click button#${id}` : text ? `click "${text}"` : 'click button');
  });

  // Links
  document.querySelectorAll('a[href]').forEach(a => {
    const text = ((a as HTMLElement).textContent ?? '').trim().slice(0, 30);
    const href = a.getAttribute('href') ?? '';
    if (text) actions.push(`navigate "${text}" → ${href}`);
  });

  // Form inputs
  document.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(input => {
    const type  = (input as HTMLInputElement).type ?? input.tagName.toLowerCase();
    const name  = (input as HTMLInputElement).name;
    const label = name ?? input.id ?? type;
    actions.push(`fill ${label} (${type})`);
  });

  return Array.from(new Set(actions)).slice(0, 20);
}

function getCurrentRoute(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.pathname + window.location.search || undefined;
}

// ── captureScreenSchema ────────────────────────────────────────────────

export function captureScreenSchema(): ScreenSchema {
  const signalEntries = _schemaRegistry.map(entry => ({
    id:    entry.id,
    ...(entry.label !== undefined ? { label: entry.label } : {}),
    value: entry.signal.peek(),
    type:  typeof entry.signal.peek(),
    ...(entry.meta !== undefined ? { meta: entry.meta } : {}),
  }));

  let dom: string | undefined;
  if (typeof document !== 'undefined' && document.body) {
    try {
      dom = compactDOM(document.body);
    } catch { /* ignore DOM errors */ }
  }

  const route = getCurrentRoute();
  return {
    version:      '1.0',
    timestamp:    Date.now(),
    ...(route !== undefined ? { route } : {}),
    signals:      signalEntries,
    ...(dom !== undefined ? { dom } : {}),
    interactions: getInteractions(),
  };
}

// ── restoreFromSchema ──────────────────────────────────────────────────

export function restoreFromSchema(schema: ScreenSchema): void {
  for (const entry of schema.signals) {
    const reg = _schemaRegistry.find(r => r.id === entry.id);
    if (reg) {
      try {
        reg.signal.set(entry.value);
      } catch { /* read-only computed — skip */ }
    }
  }
}

// ── schemaToPrompt ─────────────────────────────────────────────────────

export function schemaToPrompt(schema: ScreenSchema): string {
  const parts: string[] = [];

  if (schema.route) {
    parts.push(`The user is on route: ${schema.route}.`);
  }

  if (schema.signals.length > 0) {
    const sigLines = schema.signals.map(s => {
      const label = s.label ?? s.id;
      const val   = JSON.stringify(s.value);
      const meta  = s.meta as Record<string, unknown> | undefined;
      const desc  = meta?.['description'] ? ` (${meta['description']})` : '';
      return `  - ${label}: ${val}${desc}`;
    });
    parts.push(`Current application state:\n${sigLines.join('\n')}`);
  }

  if (schema.interactions && schema.interactions.length > 0) {
    parts.push(`Available user actions:\n${schema.interactions.map(i => `  - ${i}`).join('\n')}`);
  }

  if (schema.dom) {
    // Provide a condensed version — full DOM can be very large
    const snippet = schema.dom.slice(0, 300);
    parts.push(`Page structure (compact): ${snippet}${schema.dom.length > 300 ? '…' : ''}`);
  }

  return parts.join('\n\n');
}
