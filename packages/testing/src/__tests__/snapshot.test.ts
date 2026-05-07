import { describe, it, expect } from 'vitest';
import { captureSnapshot, diffSnapshots } from '../index.js';

// Helper: create an element from an HTML string
function el(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.firstElementChild as HTMLElement;
}

describe('captureSnapshot', () => {
  it('serializes a simple element', () => {
    const elem = document.createElement('button');
    elem.className = 'my-btn';
    elem.textContent = 'Click me';
    const snap = captureSnapshot(elem);
    expect(snap).toContain('<button');
    expect(snap).toContain('class="my-btn"');
    expect(snap).toContain('Click me');
  });

  it('sorts attributes alphabetically', () => {
    const elem = document.createElement('div');
    elem.setAttribute('z-attr', 'z');
    elem.setAttribute('a-attr', 'a');
    elem.setAttribute('m-attr', 'm');
    const snap = captureSnapshot(elem, { sortAttrs: true });
    const aPos = snap.indexOf('a-attr');
    const mPos = snap.indexOf('m-attr');
    const zPos = snap.indexOf('z-attr');
    expect(aPos).toBeLessThan(mPos);
    expect(mPos).toBeLessThan(zPos);
  });

  it('strips data-dr-id attributes', () => {
    const elem = document.createElement('div');
    elem.setAttribute('data-dr-id', 'abc123');
    elem.setAttribute('class', 'foo');
    const snap = captureSnapshot(elem, { stripDynamic: true });
    expect(snap).not.toContain('data-dr-id');
    expect(snap).toContain('class="foo"');
  });

  it('normalizes whitespace in text', () => {
    const elem = document.createElement('p');
    elem.textContent = '  hello   world  ';
    const snap = captureSnapshot(elem, { normalizeText: true });
    expect(snap).toContain('hello world');
    expect(snap).not.toContain('  hello');
  });

  it('handles nested elements', () => {
    const parent = document.createElement('div');
    parent.className = 'parent';
    const child = document.createElement('span');
    child.textContent = 'child text';
    parent.appendChild(child);
    const snap = captureSnapshot(parent);
    expect(snap).toContain('<div');
    expect(snap).toContain('<span>child text</span>');
  });

  it('handles void elements', () => {
    const elem = document.createElement('div');
    const img = document.createElement('img');
    img.setAttribute('alt', 'test image');
    img.setAttribute('src', '/img.png');
    elem.appendChild(img);
    const snap = captureSnapshot(elem);
    // img should be self-closing
    expect(snap).toContain('<img');
    expect(snap).not.toMatch(/<img[^>]*><\/img>/);
  });

  it('ignores custom attrs', () => {
    const elem = document.createElement('div');
    elem.setAttribute('data-testid', 'my-div');
    elem.setAttribute('class', 'wrapper');
    const snap = captureSnapshot(elem, { ignoreAttrs: ['data-testid'] });
    expect(snap).not.toContain('data-testid');
    expect(snap).toContain('class="wrapper"');
  });
});

describe('diffSnapshots', () => {
  it('returns identical for same input', () => {
    const snap = '<div class="foo">Hello</div>';
    const diff = diffSnapshots(snap, snap);
    expect(diff.identical).toBe(true);
    expect(diff.summary).toBe('No changes');
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('detects added lines', () => {
    const before = '<div>\n  <span>existing</span>\n</div>';
    const after  = '<div>\n  <span>existing</span>\n  <p>new paragraph</p>\n</div>';
    const diff = diffSnapshots(before, after);
    expect(diff.identical).toBe(false);
    expect(diff.added.some(l => l.includes('new paragraph'))).toBe(true);
  });

  it('detects removed lines', () => {
    const before = '<div>\n  <span>existing</span>\n  <p>old paragraph</p>\n</div>';
    const after  = '<div>\n  <span>existing</span>\n</div>';
    const diff = diffSnapshots(before, after);
    expect(diff.identical).toBe(false);
    expect(diff.removed.some(l => l.includes('old paragraph'))).toBe(true);
  });

  it('detects changed elements', () => {
    const before = '<div class="old">text</div>';
    const after  = '<div class="new">text</div>';
    const diff = diffSnapshots(before, after);
    expect(diff.identical).toBe(false);
    // Should have a change entry linking old → new
    expect(diff.changed.length).toBeGreaterThan(0);
    expect(diff.changed[0]).toContain('→');
  });

  it('summary describes changes', () => {
    const before = '<div>\n  <span>hello</span>\n</div>';
    const after  = '<div>\n  <p>world</p>\n</div>';
    const diff = diffSnapshots(before, after);
    expect(diff.identical).toBe(false);
    expect(diff.summary).toBeTruthy();
    expect(diff.summary).not.toBe('No changes');
  });
});
