import { describe, it, expect } from 'vitest';
import { transformReact } from '../codemods/react.js';

describe('transformReact', () => {
  it('transforms useState to signal', () => {
    const code = `const [count, setCount] = useState(0);`;
    const result = transformReact(code);
    expect(result.code).toContain('const count = signal(0)');
    expect(result.code).not.toContain('useState');
  });

  it('transforms multiple useState declarations', () => {
    const code = [
      `const [count, setCount] = useState(0);`,
      `const [name, setName] = useState('Alice');`,
    ].join('\n');
    const result = transformReact(code);
    expect(result.code).toContain('const count = signal(0)');
    expect(result.code).toContain("const name = signal('Alice')");
  });

  it('transforms useEffect to effect', () => {
    const code = `useEffect(() => { console.log('hello'); }, []);`;
    const result = transformReact(code);
    expect(result.code).toContain('effect(');
    expect(result.code).not.toContain('useEffect');
  });

  it('transforms useMemo to computed', () => {
    const code = `const doubled = useMemo(() => count * 2, [count]);`;
    const result = transformReact(code);
    expect(result.code).toContain('computed(');
    expect(result.code).not.toContain('useMemo');
  });

  it('transforms React default import', () => {
    const code = `import React from 'react';`;
    const result = transformReact(code);
    expect(result.code).toContain('// Drishti (no React import needed)');
    expect(result.code).not.toContain("import React from 'react'");
  });

  it('transforms named React imports', () => {
    const code = `import { useState, useEffect, useCallback } from 'react';`;
    const result = transformReact(code);
    expect(result.code).toContain("from '@drishti/runtime'");
    expect(result.code).not.toContain("from 'react'");
  });

  it('records changes array with line numbers', () => {
    const code = `import React from 'react';\nconst [x, setX] = useState(0);`;
    const result = transformReact(code);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0]).toHaveProperty('line');
    expect(result.changes[0]).toHaveProperty('from');
    expect(result.changes[0]).toHaveProperty('to');
  });

  it('flags JSX for manual review', () => {
    const code = `return <div className="foo"><span>Hello</span></div>;`;
    const result = transformReact(code);
    expect(result.manualReviewNeeded.some((m) => /JSX/i.test(m))).toBe(true);
  });

  it('flags React.createElement for manual review', () => {
    const code = `const el = React.createElement('div', { className: 'foo' }, 'Hello');`;
    const result = transformReact(code);
    expect(result.manualReviewNeeded.some((m) => /createElement/i.test(m))).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('adds Island comment to export default function', () => {
    const code = `export default function MyComponent() { return null; }`;
    const result = transformReact(code);
    expect(result.code).toContain('// Island: eager');
  });

  it('transforms setState calls best-effort', () => {
    const code = `const [count, setCount] = useState(0);\nsetCount(5);`;
    const result = transformReact(code);
    expect(result.code).toContain('count.set(5)');
    expect(result.manualReviewNeeded.some((m) => /setState|signal\.set/i.test(m))).toBe(true);
  });

  it('returns empty changes for code with no React patterns', () => {
    const code = `const x = 1 + 2;\nconsole.log(x);`;
    const result = transformReact(code);
    expect(result.changes).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
