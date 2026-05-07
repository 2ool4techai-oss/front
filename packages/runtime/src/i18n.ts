import { signal, computed } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type Locale         = string;
export type Messages       = Record<string, string>;
export type MessageCatalog = Record<Locale, Messages>;

export interface I18nOptions {
  locale:          Locale;
  fallbackLocale?: Locale;
  messages:        MessageCatalog;
  numberFormats?:  Record<Locale, Intl.NumberFormatOptions>;
  dateFormats?:    Record<Locale, Intl.DateTimeFormatOptions>;
}

export interface I18nInstance {
  readonly locale:     Signal<Locale>;
  setLocale(l: Locale): void;
  /** Translate key with optional interpolation vars and plural count */
  t(key: string, vars?: Record<string, unknown>): string;
  /** Reactive computed translation — re-evaluates when locale changes */
  rt(key: string, vars?: Record<string, unknown>): ComputedSignal<string>;
  /** Format a number in the current locale */
  n(value: number, opts?: Intl.NumberFormatOptions): string;
  /** Format a date in the current locale */
  d(date: Date | number, opts?: Intl.DateTimeFormatOptions): string;
  /** Relative time (e.g. "3 days ago") */
  r(value: number, unit: Intl.RelativeTimeFormatUnit): string;
}

// ── Interpolation ──────────────────────────────────────────────────────
// Replaces {key} placeholders; handles plurals via pipe: "one item | {count} items"
function interpolate(template: string, vars: Record<string, unknown> = {}): string {
  // Plural form: "singular | plural" — chosen by vars.count
  if (template.includes(' | ')) {
    const count = Number(vars['count'] ?? 0);
    const forms = template.split(' | ');
    // Intl.PluralRules selects the right form index for the locale,
    // but we don't have locale here, so use simple 1 = first, else last
    const idx = count === 1 ? 0 : Math.min(forms.length - 1, 1);
    template = forms[idx] ?? template;
  }
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v !== undefined ? String(v) : `{${k}}`;
  });
}

// ── Resolve ────────────────────────────────────────────────────────────
// Supports dot-notation: 'nav.home' => messages['nav.home'] or messages.nav.home
function resolve(messages: Messages, key: string): string | undefined {
  if (key in messages) return messages[key];
  // dot-notation fallback
  const parts = key.split('.');
  let node: unknown = messages;
  for (const p of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return typeof node === 'string' ? node : undefined;
}

// ── createI18n ─────────────────────────────────────────────────────────
export function createI18n(opts: I18nOptions): I18nInstance {
  const _locale   = signal<Locale>(opts.locale);
  const _messages = opts.messages;
  const _fallback = opts.fallbackLocale;

  const translate = (key: string, vars?: Record<string, unknown>): string => {
    const loc = _locale.peek();
    const msgs = _messages[loc] ?? {};
    const fbMsgs = _fallback ? (_messages[_fallback] ?? {}) : {};

    const raw = resolve(msgs, key) ?? resolve(fbMsgs, key) ?? key;
    return interpolate(raw, vars);
  };

  const _pluralRules = new Map<Locale, Intl.PluralRules>();
  const pluralRules = (loc: Locale): Intl.PluralRules => {
    if (!_pluralRules.has(loc)) _pluralRules.set(loc, new Intl.PluralRules(loc));
    return _pluralRules.get(loc)!;
  };

  // Enhanced translate with proper plural rules from Intl
  const translatePlural = (key: string, vars?: Record<string, unknown>): string => {
    const loc = _locale.peek();
    const msgs = _messages[loc] ?? {};
    const fbMsgs = _fallback ? (_messages[_fallback] ?? {}) : {};
    const raw = resolve(msgs, key) ?? resolve(fbMsgs, key) ?? key;

    if (!raw.includes(' | ') || !vars?.['count']) {
      return interpolate(raw, vars);
    }

    const count  = Number(vars['count']);
    const forms  = raw.split(' | ');
    const pr     = pluralRules(loc);
    const form   = pr.select(count); // 'zero'|'one'|'two'|'few'|'many'|'other'

    let chosen: string;
    if (forms.length === 2) {
      // Common "singular | plural" pattern: 'one' → forms[0], everything else → forms[1]
      chosen = form === 'one' ? forms[0]! : forms[1]!;
    } else {
      const ORDER: Intl.LDMLPluralRule[] = ['zero', 'one', 'two', 'few', 'many', 'other'];
      const idx = Math.min(Math.max(0, ORDER.indexOf(form)), forms.length - 1);
      chosen = forms[idx] ?? forms[forms.length - 1] ?? raw;
    }
    return interpolate(chosen, vars);
  };

  const _nfCache = new Map<string, Intl.NumberFormat>();
  const _dtCache = new Map<string, Intl.DateTimeFormat>();
  const _rtCache = new Map<string, Intl.RelativeTimeFormat>();

  const nfKey = (loc: string, o: Intl.NumberFormatOptions) => `${loc}:${JSON.stringify(o)}`;

  return {
    locale:    _locale,
    setLocale: (l: Locale) => _locale.set(l),

    t: (key, vars) => translatePlural(key, vars),

    rt: (key, vars) => computed(() => {
      _locale(); // track locale changes
      return translatePlural(key, vars);
    }),

    n: (value, opts = {}) => {
      const loc = _locale.peek();
      const merged = { ...(opts.style === undefined && (opts as Record<string, unknown>).preset
        ? {} : {}), ...opts };
      const k = nfKey(loc, merged);
      if (!_nfCache.has(k)) _nfCache.set(k, new Intl.NumberFormat(loc, merged));
      return _nfCache.get(k)!.format(value);
    },

    d: (date, opts = {}) => {
      const loc = _locale.peek();
      const k   = `${loc}:${JSON.stringify(opts)}`;
      if (!_dtCache.has(k)) _dtCache.set(k, new Intl.DateTimeFormat(loc, opts));
      return _dtCache.get(k)!.format(date instanceof Date ? date : new Date(date));
    },

    r: (value, unit) => {
      const loc = _locale.peek();
      if (!_rtCache.has(loc)) _rtCache.set(loc, new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }));
      return _rtCache.get(loc)!.format(value, unit);
    },
  };
}
