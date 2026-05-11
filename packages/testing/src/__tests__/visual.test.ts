import { describe, it, expect } from 'vitest';
import { takeSnapshot, diffSnapshots, assertVisualMatch, setupVisualMatchers } from '../visual.js';

function makeEl(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.firstElementChild as HTMLElement ?? div;
}

describe('takeSnapshot', () => {
  it('returns a VisualSnapshot object', () => {
    const el = makeEl('<div class="box">Hello</div>');
    const snap = takeSnapshot(el, 'my-snap');
    expect(snap).toBeDefined();
    expect(typeof snap.id).toBe('string');
    expect(typeof snap.name).toBe('string');
    expect(typeof snap.timestamp).toBe('number');
    expect(typeof snap.html).toBe('string');
  });

  it('snapshot has id, name, timestamp', () => {
    const el = makeEl('<p>Test</p>');
    const snap = takeSnapshot(el, 'para-snap');
    expect(snap.id.length).toBeGreaterThan(0);
    expect(snap.name).toBe('para-snap');
    expect(snap.timestamp).toBeGreaterThan(0);
  });

  it('snapshot.html contains element outerHTML', () => {
    const el = makeEl('<span class="foo">bar</span>');
    const snap = takeSnapshot(el, 'span-snap');
    expect(snap.html).toContain('foo');
    expect(snap.html).toContain('bar');
  });
});

describe('diffSnapshots', () => {
  it('identical snapshots return changed=false', () => {
    const el = makeEl('<div class="foo">Hello</div>');
    const a  = takeSnapshot(el, 'a');
    const b  = takeSnapshot(el, 'b');
    // Force same HTML (since takeSnapshot reads outerHTML which is same object)
    const diff = diffSnapshots(a, b);
    expect(diff.changed).toBe(false);
  });

  it('different HTML returns structureChanged=true', () => {
    const el1 = makeEl('<div class="foo">Hello</div>');
    const el2 = makeEl('<div class="bar">World</div>');
    const a   = takeSnapshot(el1, 'a');
    const b   = takeSnapshot(el2, 'b');
    const diff = diffSnapshots(a, b);
    expect(diff.structureChanged).toBe(true);
  });

  it('added class detected in additions', () => {
    const el1 = makeEl('<div class="foo">Hi</div>');
    const el2 = makeEl('<div class="foo extra">Hi</div>');
    const a   = takeSnapshot(el1, 'a');
    const b   = takeSnapshot(el2, 'b');
    const diff = diffSnapshots(a, b);
    expect(diff.additions).toContain('extra');
  });

  it('removed class detected in removals', () => {
    const el1 = makeEl('<div class="foo gone">Hi</div>');
    const el2 = makeEl('<div class="foo">Hi</div>');
    const a   = takeSnapshot(el1, 'a');
    const b   = takeSnapshot(el2, 'b');
    const diff = diffSnapshots(a, b);
    expect(diff.removals).toContain('gone');
  });
});

describe('assertVisualMatch', () => {
  it('passes on identical snapshots', () => {
    const el   = makeEl('<div class="foo">Same</div>');
    const base = takeSnapshot(el, 'base');
    expect(() => assertVisualMatch(el, base)).not.toThrow();
  });

  it('throws on changed snapshots with threshold=0', () => {
    const el1 = makeEl('<div class="foo">Before</div>');
    const base = takeSnapshot(el1, 'base');
    const el2  = makeEl('<div class="bar">After</div>');
    expect(() => assertVisualMatch(el2, base)).toThrow();
  });
});

describe('setupVisualMatchers', () => {
  it('does not throw when called', () => {
    expect(() => setupVisualMatchers()).not.toThrow();
  });
});
