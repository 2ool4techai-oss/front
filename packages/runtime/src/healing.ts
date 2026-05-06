import type { HealConfig, CircuitState } from './types.js';

// ── HealingMonitor ─────────────────────────────────────────────────────

export type HealStatus = 'healthy' | 'healing' | 'recovered' | 'failed';

export interface HealEvent {
  type: 'error' | 'recovered' | 'failed';
  attempt: number;
  error?: unknown;
}

type HealListener = (ev: HealEvent) => void;

const DEFAULT_BACKOFF_BASE = 300;
const MAX_BACKOFF_MS       = 30_000;

export class HealingMonitor {
  private _status:           HealStatus = 'healthy';
  private _attempt:          number = 0;
  private _listeners:        Set<HealListener> = new Set();
  private _aborted:          boolean = false;
  private _fallbackRendered: boolean = false;
  private _staleEl:          HTMLElement | null = null;

  constructor(
    private readonly cfg: HealConfig,
    private readonly el: HTMLElement,
    private readonly renderFallback?: (el: HTMLElement, reason: string) => void,
  ) {}

  get status(): HealStatus { return this._status; }
  get attempt(): number { return this._attempt; }

  on(fn: HealListener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _emit(ev: HealEvent): void {
    for (const fn of this._listeners) fn(ev);
  }

  async handle(error: unknown, retry: () => Promise<void>): Promise<void> {
    if (this._aborted) return;

    this._status = 'healing';
    this._emit({ type: 'error', attempt: this._attempt, error });

    if (this.cfg.mode === 'auto' || this.cfg.mode === 'retry') {
      const maxRetries = this.cfg.retries ?? 3;

      while (this._attempt < maxRetries && !this._aborted) {
        this._attempt++;
        const backoff = Math.min(DEFAULT_BACKOFF_BASE * Math.pow(2, this._attempt - 1), MAX_BACKOFF_MS);
        this._showHealUI(`Retrying… (${this._attempt}/${maxRetries})`);
        await sleep(backoff);

        try {
          await retry();
          this._status = 'recovered';
          this._attempt = 0;
          this._emit({ type: 'recovered', attempt: this._attempt });
          this._clearHealUI();
          return;
        } catch { /* continue */ }
      }
    }

    this._status = 'failed';
    this._emit({ type: 'failed', attempt: this._attempt });
    this._showFallback(error);
  }

  // Show stale content while healing (instead of blank + spinner)
  preserveStale(): void {
    if (this.el.children.length > 0) {
      this._staleEl = this.el.cloneNode(true) as HTMLElement;
    }
  }

  private _showHealUI(msg: string): void {
    let banner = this.el.querySelector<HTMLElement>('[data-dr-heal]');
    if (!banner) {
      banner = document.createElement('div');
      banner.setAttribute('data-dr-heal', '');
      banner.style.cssText = [
        'position:absolute',
        'inset:0',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'background:rgba(0,0,0,.55)',
        'border-radius:inherit',
        'font-size:.8rem',
        'color:rgba(255,255,255,.7)',
        'font-family:var(--dr-font-family,system-ui,sans-serif)',
        'pointer-events:none',
        'z-index:10',
        'gap:8px',
      ].join(';');
      this.el.style.position = 'relative';
      this.el.appendChild(banner);
    }
    banner.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:rgba(255,255,255,.8);border-radius:50%;animation:dr-spin .7s linear infinite"></span><span>${sanitizeText(msg)}</span>`;
    injectSpinKeyframe();
  }

  private _clearHealUI(): void {
    this.el.querySelector('[data-dr-heal]')?.remove();
  }

  private _showFallback(error: unknown): void {
    if (this._fallbackRendered) return;
    this._fallbackRendered = true;
    this._clearHealUI();

    if (this.renderFallback) {
      this.renderFallback(this.el, String(error));
      return;
    }

    const fb = document.createElement('div');
    fb.setAttribute('data-dr-fallback', '');
    fb.style.cssText = [
      'padding:16px 20px',
      'background:rgba(244,63,94,.08)',
      'border:1px solid rgba(244,63,94,.3)',
      'border-radius:var(--dr-border-radius,8px)',
      'color:rgba(244,63,94,.9)',
      'font-size:.85rem',
      'font-family:var(--dr-font-family,system-ui,sans-serif)',
      'display:flex',
      'flex-direction:column',
      'gap:4px',
    ].join(';');
    fb.innerHTML = `<strong>Something went wrong</strong><small style="opacity:.7">${sanitizeText(String(error))}</small>`;
    this.el.innerHTML = '';
    this.el.appendChild(fb);
  }

  reset(): void {
    this._attempt = 0;
    this._status = 'healthy';
    this._fallbackRendered = false;
    this._clearHealUI();
  }

  destroy(): void {
    this._aborted = true;
    this._listeners.clear();
  }
}

// ── CircuitBreaker ─────────────────────────────────────────────────────
// Protects downstream calls: after `threshold` failures → opens (blocks calls).
// After `timeout` ms → half-opens (allows one probe). On success → closes again.

export interface CircuitBreakerConfig {
  threshold?:        number;  // consecutive failures to open (default 3)
  timeout?:          number;  // ms before half-open probe (default 10 000)
  successThreshold?: number;  // successes to close from half-open (default 2)
  onStateChange?:    (state: CircuitState) => void;
}

export class CircuitBreaker {
  private _state:        CircuitState = 'closed';
  private _failures:     number = 0;
  private _lastFailureAt:number = 0;
  private _halfOpenOk:   number = 0;

  private readonly threshold:        number;
  private readonly timeout:          number;
  private readonly successThreshold: number;
  private readonly onStateChange:   ((s: CircuitState) => void) | undefined;

  constructor(cfg: CircuitBreakerConfig = {}) {
    this.threshold        = cfg.threshold        ?? 3;
    this.timeout          = cfg.timeout          ?? 10_000;
    this.successThreshold = cfg.successThreshold ?? 2;
    this.onStateChange    = cfg.onStateChange;
  }

  get state(): CircuitState { return this._state; }
  get isOpen(): boolean     { return this._state === 'open'; }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this._state === 'open') {
      if (Date.now() - this._lastFailureAt > this.timeout) {
        this._transition('half-open');
        this._halfOpenOk = 0;
      } else {
        throw new Error('[DRISHTI] Circuit breaker is open — call blocked');
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (e) {
      this._onFailure();
      throw e;
    }
  }

  private _onSuccess(): void {
    if (this._state === 'half-open') {
      this._halfOpenOk++;
      if (this._halfOpenOk >= this.successThreshold) {
        this._failures = 0;
        this._transition('closed');
      }
    } else if (this._state === 'closed') {
      this._failures = 0; // reset on any success
    }
  }

  private _onFailure(): void {
    this._lastFailureAt = Date.now();
    this._failures++;
    if (this._state === 'half-open' || this._failures >= this.threshold) {
      this._transition('open');
    }
  }

  private _transition(next: CircuitState): void {
    if (this._state === next) return;
    this._state = next;
    this.onStateChange?.(next);
  }

  reset(): void {
    this._failures  = 0;
    this._halfOpenOk= 0;
    this._transition('closed');
  }
}

// ── createErrorBoundary ────────────────────────────────────────────────
// Wraps synchronous render calls so a single component failure can't
// crash the entire tree. On error: renders fallback and stops propagation.

export interface ErrorBoundaryOptions {
  fallback?: (error: unknown) => HTMLElement;
  onError?:  (error: unknown) => void;
}

export interface ErrorBoundary {
  wrap<T>(fn: () => T): T | null;
  reset(): void;
  readonly hasError: boolean;
}

export function createErrorBoundary(
  el: HTMLElement,
  opts: ErrorBoundaryOptions = {},
): ErrorBoundary {
  let errored    = false;
  let fallbackEl: HTMLElement | null = null;

  return {
    get hasError() { return errored; },

    wrap<T>(fn: () => T): T | null {
      if (errored) return null;
      try {
        return fn();
      } catch (e) {
        errored = true;
        opts.onError?.(e);
        fallbackEl = opts.fallback ? opts.fallback(e) : defaultFallbackEl(e);
        el.appendChild(fallbackEl);
        return null;
      }
    },

    reset(): void {
      errored = false;
      fallbackEl?.remove();
      fallbackEl = null;
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function sanitizeText(s: string): string {
  return s.replace(/[<>&"']/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function defaultFallbackEl(error: unknown): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-dr-error-boundary', '');
  el.style.cssText = 'padding:12px 16px;background:rgba(244,63,94,.07);border:1px solid rgba(244,63,94,.25);border-radius:var(--dr-border-radius,8px);color:rgba(244,63,94,.85);font-size:.8rem;font-family:var(--dr-font-family,system-ui,sans-serif)';
  el.textContent = `Error: ${sanitizeText(String(error))}`;
  return el;
}

let _spinInjected = false;
function injectSpinKeyframe(): void {
  if (_spinInjected) return;
  _spinInjected = true;
  const s = document.createElement('style');
  s.textContent = '@keyframes dr-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}
