import { signal, computed } from './signal.js';
import type { ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type Translations = Record<string, string | Record<string, string>>;
export type LocaleCode = string; // 'en', 'fr', 'de', 'ja', etc.

export interface I18nOptions {
  locale: LocaleCode;
  messages: Record<LocaleCode, Translations>;
  fallbackLocale?: LocaleCode;
}

export interface I18nHandle {
  locale: { (): LocaleCode };
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: LocaleCode) => void;
  rt: (key: string, params?: Record<string, string | number>) => ComputedSignal<string>;
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  d: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  r: (value: number, unit: Intl.RelativeTimeFormatUnit) => string;
}

// ── Resolve ────────────────────────────────────────────────────────────
// Supports dot-notation: 'nav.home' => translations.nav.home
// But also supports literal dot-keys stored as 'nav.home' directly
function resolve(translations: Translations, key: string): string | undefined {
  // First check literal key match
  if (key in translations) {
    const val = translations[key];
    return typeof val === 'string' ? val : undefined;
  }
  // dot-notation traversal
  const parts = key.split('.');
  let node: unknown = translations;
  for (const p of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return typeof node === 'string' ? node : undefined;
}

// ── Interpolation & Pluralization ──────────────────────────────────────
// Supports single-brace {name} style
// Pluralization: 'singular | plural' selected by params.count
function interpolate(
  template: string,
  params: Record<string, string | number> = {},
): string {
  // Pluralization: templates like '{count} item | {count} items'
  if (template.includes(' | ')) {
    const count = params['count'];
    if (count !== undefined) {
      const parts = template.split(' | ');
      const idx = Number(count) === 1 ? 0 : 1;
      template = parts[idx] ?? parts[0];
    }
  }

  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v !== undefined ? String(v) : `{${k}}`;
  });
}

// ── createI18n ─────────────────────────────────────────────────────────
export function createI18n(opts: I18nOptions): I18nHandle {
  const { locale: initialLocale, messages, fallbackLocale } = opts;

  const _locale = signal<LocaleCode>(initialLocale);
  const _messages = signal<Record<LocaleCode, Translations>>(messages);

  const _t = (key: string, params?: Record<string, string | number>): string => {
    const loc = _locale();
    const store = _messages();
    const locTranslations = store[loc] ?? {};
    const raw =
      resolve(locTranslations, key) ??
      (fallbackLocale ? resolve(store[fallbackLocale] ?? {}, key) : undefined);

    if (raw === undefined) {
      return key;
    }

    return interpolate(raw, params);
  };

  return {
    locale: _locale,

    t: _t,

    setLocale: (locale: LocaleCode) => {
      _locale.set(locale);
    },

    rt: (key: string, params?: Record<string, string | number>): ComputedSignal<string> => {
      return computed(() => _t(key, params));
    },

    n: (value: number, options?: Intl.NumberFormatOptions): string => {
      const loc = _locale.peek();
      return new Intl.NumberFormat(loc, options).format(value);
    },

    d: (value: Date, options?: Intl.DateTimeFormatOptions): string => {
      const loc = _locale.peek();
      return new Intl.DateTimeFormat(loc, options).format(value);
    },

    r: (value: number, unit: Intl.RelativeTimeFormatUnit): string => {
      const loc = _locale.peek();
      return new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }).format(value, unit);
    },
  };
}
