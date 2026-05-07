import { describe, it, expect } from 'vitest';
import { createI18n } from '../i18n.js';

const messages = {
  en: {
    hello:      'Hello, {name}!',
    items:      '{count} item | {count} items',
    'nav.home': 'Home',
    greeting:   'Welcome',
  },
  fr: {
    hello:    'Bonjour, {name}!',
    greeting: 'Bienvenue',
  },
};

describe('createI18n', () => {
  it('translates a simple key', () => {
    const i18n = createI18n({ locale: 'en', messages });
    expect(i18n.t('greeting')).toBe('Welcome');
  });

  it('interpolates variables', () => {
    const i18n = createI18n({ locale: 'en', messages });
    expect(i18n.t('hello', { name: 'World' })).toBe('Hello, World!');
  });

  it('returns key when missing', () => {
    const i18n = createI18n({ locale: 'en', messages });
    expect(i18n.t('missing.key')).toBe('missing.key');
  });

  it('pluralizes correctly', () => {
    const i18n = createI18n({ locale: 'en', messages });
    expect(i18n.t('items', { count: 1 })).toBe('1 item');
    expect(i18n.t('items', { count: 5 })).toBe('5 items');
  });

  it('supports dot-notation keys', () => {
    const i18n = createI18n({ locale: 'en', messages });
    expect(i18n.t('nav.home')).toBe('Home');
  });

  it('falls back to fallbackLocale', () => {
    const i18n = createI18n({ locale: 'fr', fallbackLocale: 'en', messages });
    // 'items' is not in French, should fall back to English
    expect(i18n.t('items', { count: 1 })).toBe('1 item');
  });

  it('uses active locale for translation', () => {
    const i18n = createI18n({ locale: 'en', messages });
    expect(i18n.t('hello', { name: 'Alice' })).toBe('Hello, Alice!');
    i18n.setLocale('fr');
    expect(i18n.t('hello', { name: 'Alice' })).toBe('Bonjour, Alice!');
  });

  it('locale signal reflects setLocale', () => {
    const i18n = createI18n({ locale: 'en', messages });
    expect(i18n.locale()).toBe('en');
    i18n.setLocale('fr');
    expect(i18n.locale()).toBe('fr');
  });

  it('rt() returns reactive computed that updates with locale', () => {
    const i18n = createI18n({ locale: 'en', messages });
    const c = i18n.rt('greeting');
    expect(c()).toBe('Welcome');
    i18n.setLocale('fr');
    expect(c()).toBe('Bienvenue');
  });

  it('n() formats numbers', () => {
    const i18n = createI18n({ locale: 'en', messages });
    const formatted = i18n.n(1234567.89);
    expect(formatted).toContain('1,234,567');
  });

  it('n() formats currency', () => {
    const i18n = createI18n({ locale: 'en', messages });
    const formatted = i18n.n(42.5, { style: 'currency', currency: 'USD' });
    expect(formatted).toContain('42');
    expect(formatted).toContain('$');
  });

  it('d() formats dates', () => {
    const i18n = createI18n({ locale: 'en', messages });
    const d = new Date('2024-01-15');
    const formatted = i18n.d(d, { year: 'numeric', month: 'long', day: 'numeric' });
    expect(formatted).toContain('2024');
  });

  it('r() formats relative time', () => {
    const i18n = createI18n({ locale: 'en', messages });
    const result = i18n.r(-3, 'day');
    expect(result.toLowerCase()).toContain('day');
  });
});
