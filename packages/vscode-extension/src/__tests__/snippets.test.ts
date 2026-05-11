import { describe, it, expect } from 'vitest';
import { getSnippet, getAllSnippets, DRISHTI_SNIPPETS } from '../snippets.js';

describe('DRISHTI_SNIPPETS', () => {
  it('has expected keys', () => {
    expect(DRISHTI_SNIPPETS['dr-signal']).toBeDefined();
    expect(DRISHTI_SNIPPETS['dr-computed']).toBeDefined();
    expect(DRISHTI_SNIPPETS['dr-effect']).toBeDefined();
    expect(DRISHTI_SNIPPETS['dr-store']).toBeDefined();
    expect(DRISHTI_SNIPPETS['dr-machine']).toBeDefined();
    expect(DRISHTI_SNIPPETS['dr-component']).toBeDefined();
  });

  it('each snippet has prefix, body, description', () => {
    for (const snip of Object.values(DRISHTI_SNIPPETS)) {
      expect(typeof snip.prefix).toBe('string');
      expect(Array.isArray(snip.body)).toBe(true);
      expect(typeof snip.description).toBe('string');
    }
  });

  it('getSnippet returns snippet by name', () => {
    expect(getSnippet('dr-signal')).toBeDefined();
  });

  it('getSnippet returns undefined for unknown', () => {
    expect(getSnippet('nonexistent')).toBeUndefined();
  });

  it('getAllSnippets returns all snippets', () => {
    expect(getAllSnippets().length).toBe(6);
  });
});
