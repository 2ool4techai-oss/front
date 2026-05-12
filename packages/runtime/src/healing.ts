import type { HealConfig, CircuitState } from './types.js';
import { signal, computed } from './signal.js';

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

// ── Self-Healing Boundary ──────────────────────────────────────────────

export interface HealingContext {
  error: Error;
  componentName?: string;
  signalValues?: Record<string, unknown>;
  stackTrace: string;
}

export interface HealSuggestion {
  id: string;
  title: string;
  description: string;
  confidence: number;
  apply: () => void;
  preview: string;
}

interface SelfHealingOptions {
  onError?: (ctx: HealingContext) => void;
  autoHeal?: boolean;
  apiKey?: string;
}

export function createSelfHealingBoundary(
  render: () => HTMLElement,
  opts?: SelfHealingOptions,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-dr-self-heal', '');

  let currentEl: HTMLElement | null = null;

  const tryRender = (): void => {
    wrapper.innerHTML = '';
    try {
      currentEl = render();
      wrapper.appendChild(currentEl);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const ctx: HealingContext = {
        error: err,
        stackTrace: err.stack ?? '',
      };

      opts?.onError?.(ctx);

      const suggestions = diagnose(err, ctx);

      if (opts?.autoHeal && suggestions.length > 0 && suggestions[0]!.confidence >= 0.8) {
        // High-confidence auto-heal
        try {
          suggestions[0]!.apply();
          // Re-attempt render after applying fix
          setTimeout(() => { tryRender(); }, 0);
          return;
        } catch { /* fall through to UI */ }
      }

      // Show healing UI
      wrapper.appendChild(buildHealingUI(err, suggestions, wrapper, tryRender));
    }
  };

  tryRender();
  return wrapper;
}

function buildHealingUI(
  error: Error,
  suggestions: HealSuggestion[],
  wrapper: HTMLElement,
  retry: () => void,
): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = [
    'padding:16px 20px',
    'background:rgba(239,68,68,.06)',
    'border:1px solid rgba(239,68,68,.25)',
    'border-radius:var(--dr-border-radius,8px)',
    'font-family:var(--dr-font-family,system-ui,sans-serif)',
    'font-size:14px',
    'display:flex',
    'flex-direction:column',
    'gap:12px',
  ].join(';');

  const heading = document.createElement('div');
  heading.style.cssText = 'font-weight:600;color:#b91c1c;display:flex;justify-content:space-between;align-items:center';
  heading.innerHTML = `<span>Component Error</span>`;

  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Retry';
  retryBtn.style.cssText = 'padding:4px 12px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500';
  retryBtn.addEventListener('click', () => { wrapper.innerHTML = ''; retry(); });
  heading.appendChild(retryBtn);

  const errorMsg = document.createElement('p');
  errorMsg.style.cssText = 'margin:0;color:#dc2626;font-size:13px;word-break:break-word';
  errorMsg.textContent = error.message;

  container.appendChild(heading);
  container.appendChild(errorMsg);

  if (suggestions.length > 0) {
    const suggHeading = document.createElement('p');
    suggHeading.style.cssText = 'margin:0;font-weight:600;color:#374151;font-size:13px';
    suggHeading.textContent = 'Suggested fixes:';
    container.appendChild(suggHeading);

    for (const sugg of suggestions) {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #e2e8f0;border-radius:6px;overflow:hidden';

      const header = document.createElement('div');
      header.style.cssText = 'padding:8px 12px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;gap:8px';

      const title = document.createElement('span');
      title.style.cssText = 'font-weight:500;font-size:13px;color:#1e293b';
      title.textContent = sugg.title;

      const confidence = document.createElement('span');
      confidence.style.cssText = `font-size:11px;padding:2px 8px;border-radius:999px;background:${sugg.confidence >= 0.7 ? '#dcfce7' : '#fef3c7'};color:${sugg.confidence >= 0.7 ? '#166534' : '#92400e'}`;
      confidence.textContent = `${Math.round(sugg.confidence * 100)}% confidence`;

      header.appendChild(title);
      header.appendChild(confidence);

      const desc = document.createElement('p');
      desc.style.cssText = 'margin:0;padding:6px 12px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0';
      desc.textContent = sugg.description;

      const pre = document.createElement('pre');
      pre.style.cssText = 'margin:0;padding:8px 12px;background:#1e293b;color:#e2e8f0;font-size:11px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;border-top:1px solid #e2e8f0';
      pre.textContent = sugg.preview;

      const applyBtn = document.createElement('button');
      applyBtn.textContent = 'Apply fix';
      applyBtn.style.cssText = 'display:block;width:100%;padding:7px 12px;background:#3b82f6;color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:500;border-top:1px solid rgba(59,130,246,.3)';
      applyBtn.addEventListener('click', () => {
        try {
          sugg.apply();
          wrapper.innerHTML = '';
          retry();
        } catch (e) {
          applyBtn.textContent = `Fix failed: ${String(e).slice(0, 40)}`;
          applyBtn.disabled = true;
        }
      });

      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(pre);
      card.appendChild(applyBtn);
      container.appendChild(card);
    }
  }

  return container;
}

// ── diagnose ───────────────────────────────────────────────────────────

export function diagnose(error: Error, context?: HealingContext): HealSuggestion[] {
  const suggestions: HealSuggestion[] = [];
  const msg = (error.name + ' ' + error.message).toLowerCase();
  const stack = context?.stackTrace ?? error.stack ?? '';

  // Cannot read property / properties of undefined/null
  if (
    /cannot\s+read\s+propert(?:y|ies)\s+of\s+(?:undefined|null)/.test(msg) ||
    /(?:undefined|null)\s+is\s+not\s+an?\s+object/.test(msg) ||
    /cannot\s+read\s+(?:properties|property)/.test(msg)
  ) {
    // Extract the property name if possible
    const propMatch = error.message.match(/reading '([^']+)'/);
    const prop = propMatch ? propMatch[1] : 'property';

    suggestions.push({
      id: 'null-check',
      title: 'Add null/undefined guard',
      description: `The value was null or undefined when accessing '${prop}'. Add optional chaining or a guard check.`,
      confidence: 0.85,
      apply: () => { /* No-op: guidance only — user must apply to source */ },
      preview: `// Before:\nconst val = obj.${prop};\n\n// After (optional chaining):\nconst val = obj?.${prop};\n\n// Or with default:\nconst val = obj?.${prop} ?? defaultValue;`,
    });

    suggestions.push({
      id: 'default-value',
      title: 'Initialize with default value',
      description: 'Ensure the signal or variable is initialized with a safe default value.',
      confidence: 0.7,
      apply: () => { /* guidance only */ },
      preview: `// Replace:\nconst data = signal(null);\n\n// With:\nconst data = signal({ ${prop}: undefined });`,
    });
  }

  // Maximum update depth / infinite loop / circular dependency
  if (
    /maximum\s+update\s+depth|too\s+many\s+re.?renders|infinite\s+loop|maximum\s+call\s+stack/i.test(msg) ||
    /stack\s+overflow/i.test(msg)
  ) {
    suggestions.push({
      id: 'circular-dep',
      title: 'Break circular signal dependency',
      description: 'A signal is updating itself or creating a cycle. Use untrack() to break the cycle.',
      confidence: 0.9,
      apply: () => { /* guidance only */ },
      preview: `import { untrack } from '@nexoraaidrishti/runtime';\n\n// Instead of:\neffect(() => {\n  mySignal.set(compute(mySignal()));\n});\n\n// Use:\neffect(() => {\n  const current = untrack(() => mySignal());\n  mySignal.set(compute(current));\n});`,
    });

    suggestions.push({
      id: 'batch-updates',
      title: 'Batch signal updates',
      description: 'Use batch() to group multiple signal writes and prevent cascading re-renders.',
      confidence: 0.65,
      apply: () => { /* guidance only */ },
      preview: `import { batch } from '@nexoraaidrishti/runtime';\n\n// Group updates:\nbatch(() => {\n  signalA.set(newA);\n  signalB.set(newB);\n});`,
    });
  }

  // Signal not found / undefined signal
  if (
    /signal\s+not\s+found|is\s+not\s+a\s+function/.test(msg) ||
    /(\w+)\s+is\s+not\s+a\s+function/.test(msg)
  ) {
    const nameMatch = error.message.match(/(\w+) is not a function/);
    const name = nameMatch ? nameMatch[1] : 'signal';

    suggestions.push({
      id: 'signal-typo',
      title: 'Check signal name / import',
      description: `'${name}' is not callable. Verify it is a signal created with signal() or imported correctly.`,
      confidence: 0.75,
      apply: () => { /* guidance only */ },
      preview: `// Ensure the signal is created:\nconst ${name} = signal(initialValue);\n\n// Read:\nconst value = ${name}();\n\n// Write:\n${name}.set(newValue);`,
    });

    // Suggest typo correction by checking common names
    const registeredNames = Array.from(
      typeof (globalThis as any).__drSignalRegistry !== 'undefined'
        ? (globalThis as any).__drSignalRegistry.keys()
        : [],
    ) as string[];

    const similar = registeredNames.filter(n =>
      levenshtein(n.toLowerCase(), name.toLowerCase()) <= 2,
    );

    if (similar.length > 0) {
      suggestions.push({
        id: 'typo-correction',
        title: `Did you mean: ${similar[0]}?`,
        description: `Found a similar signal name '${similar[0]}' in the registry.`,
        confidence: 0.6,
        apply: () => { /* guidance only */ },
        preview: `// Replace: ${name}()\n// With:    ${similar[0]}()`,
      });
    }
  }

  // Type errors
  if (/typeerror/i.test(msg)) {
    suggestions.push({
      id: 'type-mismatch',
      title: 'Type mismatch detected',
      description: 'A value has an unexpected type. Add type guards or coerce values.',
      confidence: 0.55,
      apply: () => { /* guidance only */ },
      preview: `// Use type guards:\nif (typeof value === 'string') {\n  // handle string\n} else if (Array.isArray(value)) {\n  // handle array\n}`,
    });
  }

  // Range errors (e.g., invalid array length)
  if (/rangeerror|invalid\s+array\s+length/i.test(msg)) {
    suggestions.push({
      id: 'range-guard',
      title: 'Add array bounds check',
      description: 'Array length or index is out of valid range.',
      confidence: 0.7,
      apply: () => { /* guidance only */ },
      preview: `// Safely access arrays:\nconst item = arr[index];\nif (item === undefined) return;\n\n// Or use at():\nconst last = arr.at(-1);`,
    });
  }

  // Network/fetch errors
  if (/failed\s+to\s+fetch|network\s+error|load\s+failed/i.test(msg)) {
    suggestions.push({
      id: 'network-retry',
      title: 'Add network retry logic',
      description: 'Network request failed. Wrap with retry() from the resilience module.',
      confidence: 0.8,
      apply: () => { /* guidance only */ },
      preview: `import { retry } from '@nexoraaidrishti/runtime';\n\n// Wrap fetch with retry:\nconst data = await retry(\n  () => fetch(url).then(r => r.json()),\n  { attempts: 3, delay: 1000 }\n);`,
    });
  }

  // Generic fallback suggestion if nothing specific matched
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'generic-debug',
      title: 'Enable dev mode for diagnostics',
      description: 'Turn on DRISHTI dev mode to see detailed signal logs.',
      confidence: 0.3,
      apply: () => { /* guidance only */ },
      preview: `import { _enableDevMode } from '@nexoraaidrishti/runtime';\n_enableDevMode();\n// Then check the browser console for signal details.`,
    });
  }

  return suggestions;
}

// ── Utility: Levenshtein distance for typo detection ──────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }
  return dp[m]![n]!;
}
