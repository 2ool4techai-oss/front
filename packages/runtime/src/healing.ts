import type { HealConfig } from './types.js';

export type HealStatus = 'healthy' | 'healing' | 'recovered' | 'failed';

export interface HealEvent {
  type: 'error' | 'recovered' | 'failed';
  attempt: number;
  error?: unknown;
}

type HealListener = (ev: HealEvent) => void;

const DEFAULT_BACKOFF_BASE = 300;

export class HealingMonitor {
  private _status: HealStatus = 'healthy';
  private _attempt = 0;
  private _listeners = new Set<HealListener>();
  private _aborted = false;
  private _fallbackRendered = false;

  constructor(
    private readonly cfg: HealConfig,
    private readonly el: HTMLElement,
    private readonly renderFallback?: (el: HTMLElement, reason: string) => void,
  ) {}

  get status(): HealStatus { return this._status; }

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
        const backoff = DEFAULT_BACKOFF_BASE * Math.pow(2, this._attempt - 1);
        await sleep(backoff);

        try {
          await retry();
          this._status = 'recovered';
          this._attempt = 0;
          this._emit({ type: 'recovered', attempt: this._attempt });
          this._clearHealUI();
          return;
        } catch (e) {
          this._showHealUI(`Retrying… (${this._attempt}/${maxRetries})`);
        }
      }
    }

    this._status = 'failed';
    this._emit({ type: 'failed', attempt: this._attempt });
    this._showFallback(error);
  }

  private _showHealUI(msg: string): void {
    let banner = this.el.querySelector<HTMLElement>('[data-dr-heal]');
    if (!banner) {
      banner = document.createElement('div');
      banner.setAttribute('data-dr-heal', '');
      banner.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.04);border-radius:inherit;font-size:.8rem;color:#888;pointer-events:none;z-index:10;';
      this.el.style.position = 'relative';
      this.el.appendChild(banner);
    }
    banner.textContent = msg;
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
    fb.style.cssText = 'padding:1rem;background:#fff8f8;border:1px solid #ffcdd2;border-radius:.5rem;color:#c62828;font-size:.875rem;';
    fb.innerHTML = `<strong>Something went wrong</strong><br><small>${sanitizeText(String(error))}</small>`;

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

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function sanitizeText(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
