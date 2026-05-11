import { describe, it, expect } from 'vitest';
import { createFileRouter } from '../file-router.js';

describe('createFileRouter – static routes', () => {
  it('parses index.ts as root route /', () => {
    const router = createFileRouter(['routes/index.ts']);
    expect(router.routes).toHaveLength(1);
    const r = router.routes[0]!;
    expect(r.path).toBe('/');
    expect(r.isIndex).toBe(true);
    expect(r.isDynamic).toBe(false);
  });

  it('parses a static nested route', () => {
    const router = createFileRouter(['routes/about.ts']);
    const r = router.routes[0]!;
    expect(r.path).toBe('/about');
    expect(r.isDynamic).toBe(false);
    expect(r.isCatchAll).toBe(false);
    expect(r.isLayout).toBe(false);
  });

  it('parses a deeply nested static route', () => {
    const router = createFileRouter(['routes/blog/posts.ts']);
    const r = router.routes[0]!;
    expect(r.path).toBe('/blog/posts');
    expect(r.params).toEqual([]);
  });
});

describe('createFileRouter – dynamic routes', () => {
  it('parses [slug] as dynamic segment', () => {
    const router = createFileRouter(['routes/blog/[slug].ts']);
    const r = router.routes[0]!;
    expect(r.path).toBe('/blog/:slug');
    expect(r.params).toEqual(['slug']);
    expect(r.isDynamic).toBe(true);
    expect(r.isCatchAll).toBe(false);
  });

  it('parses multiple dynamic segments', () => {
    const router = createFileRouter(['routes/[category]/[id].ts']);
    const r = router.routes[0]!;
    expect(r.path).toBe('/:category/:id');
    expect(r.params).toEqual(['category', 'id']);
    expect(r.isDynamic).toBe(true);
  });

  it('parses catch-all [...slug]', () => {
    const router = createFileRouter(['routes/[...slug].ts']);
    const r = router.routes[0]!;
    expect(r.isCatchAll).toBe(true);
    expect(r.params).toEqual(['slug']);
    expect(r.isDynamic).toBe(true);
  });
});

describe('createFileRouter – layout files', () => {
  it('detects _layout.ts as layout', () => {
    const router = createFileRouter(['routes/_layout.ts']);
    const r = router.routes[0]!;
    expect(r.isLayout).toBe(true);
  });

  it('detects nested _layout.ts as layout', () => {
    const router = createFileRouter(['routes/blog/_layout.ts']);
    const r = router.routes[0]!;
    expect(r.isLayout).toBe(true);
  });
});

describe('createFileRouter – match()', () => {
  it('matches a dynamic route and extracts params', () => {
    const router = createFileRouter(['routes/blog/[slug].ts']);
    const result = router.match('/blog/hello-world');
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ slug: 'hello-world' });
  });

  it('returns null for unmatched pathname', () => {
    const router = createFileRouter(['routes/about.ts']);
    const result = router.match('/contact');
    expect(result).toBeNull();
  });

  it('matches static route exactly', () => {
    const router = createFileRouter(['routes/about.ts']);
    const result = router.match('/about');
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({});
  });

  it('matches nested dynamic routes', () => {
    const router = createFileRouter(['routes/[category]/[id].ts']);
    const result = router.match('/electronics/42');
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ category: 'electronics', id: '42' });
  });

  it('skips layout files when matching', () => {
    const router = createFileRouter(['routes/_layout.ts', 'routes/index.ts']);
    const result = router.match('/');
    expect(result).not.toBeNull();
    expect(result!.route.isLayout).toBe(false);
  });
});

describe('createFileRouter – generate()', () => {
  it('returns a valid JS string with export const routes', () => {
    const router = createFileRouter(['routes/index.ts', 'routes/blog/[slug].ts']);
    const code = router.generate();
    expect(code).toContain('export const routes =');
    expect(code).toContain('/blog/:slug');
    expect(code).toContain('"slug"');
  });

  it('generated code contains all route paths', () => {
    const files = ['routes/index.ts', 'routes/about.ts', 'routes/blog/[slug].ts'];
    const router = createFileRouter(files);
    const code = router.generate();
    expect(code).toContain('"/about"');
    expect(code).toContain('"/blog/:slug"');
  });
});
