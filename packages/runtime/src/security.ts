import type { SecureConfig } from './types.js';

export class SecurityError extends Error {
  constructor(msg: string) { super(`[DRISHTI Security] ${msg}`); }
}

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:']);
const DANGEROUS_ATTRS = new Set(['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'style']);

export function sanitizeHTML(raw: string): string {
  const div = document.createElement('div');
  div.textContent = raw;
  return div.innerHTML;
}

export function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url, location.href);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new SecurityError(`Blocked URL with protocol: ${parsed.protocol}`);
    }
    return parsed.href;
  } catch (e) {
    if (e instanceof SecurityError) throw e;
    throw new SecurityError(`Invalid URL: ${url}`);
  }
}

export function sanitizeInput(value: unknown): string {
  if (typeof value !== 'string') return String(value);
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const v = obj[key];
    if (typeof v === 'string') {
      (out as Record<string, unknown>)[key as string] = sanitizeInput(v);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      (out as Record<string, unknown>)[key as string] = v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      (out as Record<string, unknown>)[key as string] = sanitizeObject(v as Record<string, unknown>);
    } else {
      (out as Record<string, unknown>)[key as string] = v;
    }
  }
  return out;
}

export class ZeroTrustMesh {
  private _user: Record<string, unknown> | null = null;
  private _rules = new Map<string, (user: Record<string, unknown> | null) => boolean>();

  setUser(user: Record<string, unknown> | null): void {
    this._user = user ? sanitizeObject(user) : null;
  }

  registerRule(name: string, fn: (user: Record<string, unknown> | null) => boolean): void {
    this._rules.set(name, fn);
  }

  check(cfg: SecureConfig): boolean {
    if (cfg.requirement === 'authenticated') {
      return this._user !== null;
    }

    if (cfg.requirement === 'role') {
      if (!this._user) return false;
      const roles = (this._user['roles'] as string[] | undefined) ?? [];
      return cfg.args.some(r => roles.includes(r));
    }

    if (cfg.requirement === 'public') return true;

    const rule = this._rules.get(cfg.requirement);
    if (rule) return rule(this._user);

    return false;
  }

  enforce(cfg: SecureConfig, el: HTMLElement): void {
    if (!this.check(cfg)) {
      el.setAttribute('aria-hidden', 'true');
      el.style.display = 'none';
      el.setAttribute('data-dr-blocked', 'unauthorized');
    }
  }

  sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const safe: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === 'authorization' || k.toLowerCase().startsWith('x-')) {
        safe[k] = v;
      }
    }
    return safe;
  }

  buildCSPNonce(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr));
  }
}

export const mesh = new ZeroTrustMesh();

mesh.registerRule('dev-only', () => {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
});
