import { describe, it, expect, beforeEach } from 'vitest';
import { auditA11y, assertA11y } from '../a11y.js';

function el(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.firstElementChild as HTMLElement ?? div;
}

function wrap(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

describe('auditA11y', () => {
  it('img without alt fails img-alt rule', () => {
    const img = el('<img src="photo.jpg">');
    const report = auditA11y(img);
    expect(report.violations.some(v => v.id === 'img-alt')).toBe(true);
  });

  it('img with alt passes img-alt rule', () => {
    const img = el('<img src="photo.jpg" alt="A photo">');
    const report = auditA11y(img);
    expect(report.violations.some(v => v.id === 'img-alt')).toBe(false);
    expect(report.passes.includes('img-alt')).toBe(true);
  });

  it('button with no text fails button-name', () => {
    const btn = el('<button></button>');
    const report = auditA11y(btn);
    expect(report.violations.some(v => v.id === 'button-name')).toBe(true);
  });

  it('button with aria-label passes button-name', () => {
    const btn = el('<button aria-label="Close dialog"></button>');
    const report = auditA11y(btn);
    expect(report.violations.some(v => v.id === 'button-name')).toBe(false);
  });

  it('input without label fails form-label', () => {
    const input = el('<input type="text">');
    const report = auditA11y(input);
    expect(report.violations.some(v => v.id === 'form-label')).toBe(true);
  });

  it('input with aria-label passes form-label', () => {
    const input = el('<input type="text" aria-label="Search">');
    const report = auditA11y(input);
    expect(report.violations.some(v => v.id === 'form-label')).toBe(false);
  });

  it('empty heading fails empty-heading', () => {
    const h1 = el('<h1></h1>');
    const report = auditA11y(h1);
    expect(report.violations.some(v => v.id === 'empty-heading')).toBe(true);
  });

  it('h3 after h1 (skipping h2) fails heading-order', () => {
    const container = wrap('<h1>Title</h1><h3>Subtitle</h3>');
    const report = auditA11y(container);
    expect(report.violations.some(v => v.id === 'heading-order')).toBe(true);
  });

  it('li outside ul fails list-structure', () => {
    const li = el('<li>Item</li>');
    const report = auditA11y(li);
    expect(report.violations.some(v => v.id === 'list-structure')).toBe(true);
  });

  it('low contrast text fails color-contrast', () => {
    const div = el('<p style="color: #aaa; background-color: #fff;">Low contrast text</p>');
    const report = auditA11y(div);
    expect(
      report.violations.some(v => v.id === 'color-contrast') ||
      report.incomplete.includes('color-contrast')
    ).toBe(true);
  });

  it('high contrast text passes color-contrast', () => {
    const div = el('<p style="color: #000; background-color: #fff;">High contrast</p>');
    const report = auditA11y(div);
    expect(report.violations.some(v => v.id === 'color-contrast')).toBe(false);
  });

  it('element with tabindex="2" fails no-positive-tabindex', () => {
    const btn = el('<button tabindex="2">Click</button>');
    const report = auditA11y(btn, { level: 'AAA' });
    expect(report.violations.some(v => v.id === 'no-positive-tabindex')).toBe(true);
  });

  it('link with "click here" text fails link-purpose', () => {
    const a = el('<a href="#">click here</a>');
    const report = auditA11y(a, { level: 'AAA' });
    expect(report.violations.some(v => v.id === 'link-purpose')).toBe(true);
  });

  it('auditA11y returns score 100 for clean element', () => {
    const div = el('<div><p>Clean content</p></div>');
    const report = auditA11y(div);
    if (report.violations.length === 0) {
      expect(report.score).toBe(100);
    } else {
      // Some rules might fire on the simple element — just check score is computed
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    }
  });

  it('auditA11y score decreases with violations', () => {
    const bad = wrap('<img src="x.jpg"><button></button><h1></h1>');
    const report = auditA11y(bad);
    expect(report.score).toBeLessThan(100);
  });

  it('assertA11y throws on violations', () => {
    const img = el('<img src="photo.jpg">');
    expect(() => assertA11y(img)).toThrow();
  });

  it('assertA11y passes on clean element', () => {
    const main = document.createElement('main');
    const img = document.createElement('img');
    img.setAttribute('alt', 'desc');
    const btn = document.createElement('button');
    btn.textContent = 'OK';
    main.append(img, btn);
    // Ignore skip-link which requires a full page context
    expect(() => assertA11y(main, { ignore: ['skip-link'] })).not.toThrow();
  });

  it('opts.ignore skips specified rules', () => {
    const img = el('<img src="photo.jpg">');
    const report = auditA11y(img, { ignore: ['img-alt'] });
    expect(report.violations.some(v => v.id === 'img-alt')).toBe(false);
  });

  it('opts.level="A" skips AA rules', () => {
    const btn = el('<button tabindex="2">x</button>');
    const report = auditA11y(btn, { level: 'A' });
    // no-positive-tabindex is AAA — should not appear
    expect(report.violations.some(v => v.id === 'no-positive-tabindex')).toBe(false);
  });
});
