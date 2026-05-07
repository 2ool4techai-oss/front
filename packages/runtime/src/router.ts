import { signal, computed, effect } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface RouteParams  { [key: string]: string }
export interface RouteQuery   { [key: string]: string }

export interface RouteLocation {
  path:     string;
  params:   RouteParams;
  query:    RouteQuery;
  hash:     string;
  fullPath: string;
}

export type RouteGuard = (
  to:   RouteLocation,
  from: RouteLocation | null,
) => boolean | string | Promise<boolean | string>;
// Return true → allow, false → block, string → redirect to that path

export interface RouteConfig {
  path:      string;
  component: (params: RouteParams, query: RouteQuery) => HTMLElement;
  guard?:    RouteGuard;
  meta?:     Record<string, unknown>;
  // Exact match (default true for '/', false with params)
  exact?:    boolean;
}

export interface RouterOptions {
  routes:   RouteConfig[];
  base?:    string;   // e.g. '/app' — prepended to all routes
  mode?:    'history' | 'hash';
  notFound?: (path: string) => HTMLElement;
  onNavigate?: (to: RouteLocation, from: RouteLocation | null) => void;
}

// ── Route matching ─────────────────────────────────────────────────────

interface CompiledRoute {
  config:   RouteConfig;
  pattern:  RegExp;
  keys:     string[];
}

function compileRoute(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const src = path
    .replace(/[.*+?^${}()|[\]\\]/g, (c) => c === '*' ? '.*' : `\\${c}`)
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
  return { pattern: new RegExp(`^${src}$`), keys };
}

function matchRoute(compiled: CompiledRoute, pathname: string): RouteParams | null {
  const m = pathname.match(compiled.pattern);
  if (!m) return null;
  const params: RouteParams = {};
  compiled.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1] ?? ''); });
  return params;
}

function parseQuery(search: string): RouteQuery {
  const q: RouteQuery = {};
  new URLSearchParams(search).forEach((v, k) => { q[k] = v; });
  return q;
}

function buildLocation(href: string, base: string): RouteLocation {
  const url      = new URL(href, location.origin);
  const path     = url.pathname.replace(new RegExp(`^${base}`), '') || '/';
  const query    = parseQuery(url.search);
  const hash     = url.hash.slice(1);
  return { path, params: {}, query, hash, fullPath: path + url.search + url.hash };
}

// ── Router ─────────────────────────────────────────────────────────────

export class Router {
  private _compiled:   CompiledRoute[];
  private _base:       string;
  private _mode:       'history' | 'hash';
  private _notFound:   (path: string) => HTMLElement;
  private _onNavigate: ((to: RouteLocation, from: RouteLocation | null) => void) | undefined;

  private _location: Signal<RouteLocation>;
  private _from:     RouteLocation | null = null;
  private _outlet:   HTMLElement | null = null;

  readonly location:   Signal<RouteLocation>;
  readonly params:     ComputedSignal<RouteParams>;
  readonly query:      ComputedSignal<RouteQuery>;
  readonly path:       ComputedSignal<string>;

  constructor(opts: RouterOptions) {
    this._base      = opts.base ?? '';
    this._mode      = opts.mode ?? 'history';
    this._notFound  = opts.notFound ?? defaultNotFound;
    this._onNavigate = opts.onNavigate;

    this._compiled = opts.routes.map(cfg => {
      const { pattern, keys } = compileRoute(cfg.path);
      return { config: cfg, pattern, keys };
    });

    const initial = this._currentLocation();
    this._location = signal<RouteLocation>(initial);
    this.location  = this._location;
    this.params    = computed(() => this._location().params);
    this.query     = computed(() => this._location().query);
    this.path      = computed(() => this._location().path);

    // Listen to browser navigation
    window.addEventListener('popstate', () => this._sync());
    if (this._mode === 'hash') {
      window.addEventListener('hashchange', () => this._sync());
    }

    // Intercept link clicks (anchor delegation)
    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest('a[data-dr-link]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      this.navigate(a.getAttribute('href') ?? '/');
    });
  }

  // ── Public API ────────────────────────────────────────────────────────

  async navigate(to: string, opts: { replace?: boolean; state?: unknown } = {}): Promise<void> {
    const target = this._buildHref(to);
    const loc    = buildLocation(target, this._base);

    const route = this._match(loc.path);
    if (route) {
      loc.params = route.params;
    }

    // Run guard if present
    if (route?.config.guard) {
      const result = await route.config.guard(loc, this._from);
      if (result === false) return;
      if (typeof result === 'string') { await this.navigate(result, opts); return; }
    }

    this._from = this._location.peek();
    this._onNavigate?.(loc, this._from);

    if (this._mode === 'history') {
      if (opts.replace) {
        history.replaceState(opts.state ?? null, '', target);
      } else {
        history.pushState(opts.state ?? null, '', target);
      }
    } else {
      location.hash = to.startsWith('#') ? to : `#${to}`;
    }

    this._location.set(loc);
    this._render();
  }

  replace(to: string): Promise<void> {
    return this.navigate(to, { replace: true });
  }

  back():    void { history.back(); }
  forward(): void { history.forward(); }
  go(n: number): void { history.go(n); }

  // Mount the router outlet into a container element
  mount(container: HTMLElement): () => void {
    this._outlet = container;
    this._render();

    const dispose = effect(() => {
      // Re-render when location changes (in case of programmatic updates)
      this._location(); // track
    });

    return dispose;
  }

  // ── Link helper ──────────────────────────────────────────────────────
  // Creates an <a> element that uses the router
  link(to: string, content: string | HTMLElement, attrs?: Record<string, string>): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = this._buildHref(to);
    a.setAttribute('data-dr-link', '');
    if (attrs) Object.entries(attrs).forEach(([k, v]) => a.setAttribute(k, v));

    if (typeof content === 'string') a.textContent = content;
    else a.appendChild(content);

    // Mark active
    effect(() => {
      const cur = this._location().path;
      a.classList.toggle('dr-link--active', cur === to || cur.startsWith(`${to}/`));
      a.setAttribute('aria-current', (cur === to) ? 'page' : '');
    });

    return a;
  }

  // ── Internal ─────────────────────────────────────────────────────────

  private _currentLocation(): RouteLocation {
    const href = this._mode === 'hash'
      ? location.origin + '/' + (location.hash.slice(1) || '/')
      : location.href;
    return buildLocation(href, this._base);
  }

  private _sync(): void {
    const loc = this._currentLocation();
    const route = this._match(loc.path);
    if (route) loc.params = route.params;
    this._from = this._location.peek();
    this._location.set(loc);
    this._render();
  }

  private _match(path: string): { config: RouteConfig; params: RouteParams } | null {
    for (const compiled of this._compiled) {
      const params = matchRoute(compiled, path);
      if (params !== null) return { config: compiled.config, params };
    }
    return null;
  }

  private _buildHref(to: string): string {
    if (to.startsWith('http') || to.startsWith('//')) return to;
    return this._base + (to.startsWith('/') ? to : `/${to}`);
  }

  private _render(): void {
    if (!this._outlet) return;
    const loc   = this._location.peek();
    const route = this._match(loc.path);

    const content = route
      ? route.config.component(loc.params, loc.query)
      : this._notFound(loc.path);

    // Animate out old, animate in new
    const old = this._outlet.firstElementChild as HTMLElement | null;
    if (old) {
      old.style.transition = `opacity calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.3) ease`;
      old.style.opacity    = '0';
      old.addEventListener('transitionend', () => old.remove(), { once: true });
    }

    content.style.opacity = '0';
    content.style.transform = 'translateY(6px)';
    content.style.transition = `opacity calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease, transform calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) cubic-bezier(.34,1.56,.64,1)`;
    this._outlet.appendChild(content);

    requestAnimationFrame(() => {
      content.style.opacity   = '1';
      content.style.transform = 'none';
    });
  }
}

// ── createRouter ────────────────────────────────────────────────────────
export function createRouter(opts: RouterOptions): Router {
  return new Router(opts);
}

// ── useRouter ──────────────────────────────────────────────────────────
// Returns the router instance mounted in the app. Call after createRouter().
let _instance: Router | null = null;
export function setActiveRouter(r: Router): void { _instance = r; }
export function useRouter(): Router {
  if (!_instance) throw new Error('[DRISHTI] No router. Call createRouter() and setActiveRouter().');
  return _instance;
}

// ── Default 404 ────────────────────────────────────────────────────────
function defaultNotFound(path: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;gap:12px;font-family:var(--dr-font-family,system-ui);color:var(--dr-color-text-muted,#64748b);text-align:center;padding:40px;';
  el.innerHTML = `<span style="font-size:3rem;opacity:.3">404</span><strong style="color:var(--dr-color-text,#e2e8f0);font-size:1.1rem">Page not found</strong><small>${sanitizePath(path)}</small>`;
  return el;
}

function sanitizePath(p: string): string {
  return p.replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c] ?? c));
}
