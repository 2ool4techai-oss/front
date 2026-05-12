/**
 * xss-guard.ts
 * String signals where all reads return sanitized HTML.
 * Raw value accessible only to trusted contexts.
 */

import { signal } from './signal.js';

export interface XSSGuardOptions {
  allowedTags?: string[];
  allowedAttrs?: string[];
  onAttempt?: (raw: string, sanitized: string) => void;
}

export interface XSSGuardSignal {
  (): string;
  set: (v: string) => void;
  raw: () => string;
  peek: () => string;
  wasSanitized: () => boolean;
}

/**
 * Walk the DOM tree of a node, removing disallowed tags and attributes.
 * Returns sanitized HTML string.
 */
function sanitizeDOM(
  raw: string,
  allowedTags: Set<string>,
  allowedAttrs: Set<string>,
): string {
  // Use DOMParser to parse as HTML fragment
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${raw}</body>`, 'text/html');
  const body = doc.body;

  function walk(node: Node): void {
    const toRemove: Node[] = [];
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tagName = el.tagName.toLowerCase();
        if (!allowedTags.has(tagName)) {
          // Replace disallowed element with its text content
          const text = doc.createTextNode(el.textContent ?? '');
          node.insertBefore(text, child);
          toRemove.push(child);
        } else {
          // Remove disallowed attributes
          const attrsToRemove: string[] = [];
          for (const attr of Array.from(el.attributes)) {
            if (!allowedAttrs.has(attr.name.toLowerCase())) {
              attrsToRemove.push(attr.name);
            }
          }
          for (const attr of attrsToRemove) {
            el.removeAttribute(attr);
          }
          walk(el);
        }
      }
    }
    for (const node2 of toRemove) {
      node.removeChild(node2);
    }
  }

  walk(body);
  return body.innerHTML;
}

export function xssGuardSignal(initial: string, opts?: XSSGuardOptions): XSSGuardSignal {
  const allowedTags = new Set((opts?.allowedTags ?? []).map(t => t.toLowerCase()));
  const allowedAttrs = new Set((opts?.allowedAttrs ?? []).map(a => a.toLowerCase()));

  const rawSig = signal<string>(initial);
  const sanitizedSig = signal<string>(sanitizeDOM(initial, allowedTags, allowedAttrs));
  let _wasSanitized = rawSig.peek() !== sanitizedSig.peek();

  function applySanitize(v: string): void {
    const sanitized = sanitizeDOM(v, allowedTags, allowedAttrs);
    const changed = v !== sanitized;
    _wasSanitized = changed;
    rawSig.set(v);
    sanitizedSig.set(sanitized);
    if (changed && opts?.onAttempt) {
      opts.onAttempt(v, sanitized);
    }
  }

  const sig = Object.assign(
    function (): string {
      // Track access via sanitized signal for reactivity
      return sanitizedSig();
    },
    {
      set(v: string): void {
        applySanitize(v);
      },

      raw(): string {
        return rawSig.peek();
      },

      peek(): string {
        return sanitizedSig.peek();
      },

      wasSanitized(): boolean {
        return _wasSanitized;
      },
    },
  ) as XSSGuardSignal;

  return sig;
}
