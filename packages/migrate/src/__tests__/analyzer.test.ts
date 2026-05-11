import { describe, it, expect } from 'vitest';
import { analyzeFile, analyzeProject } from '../analyzer.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('analyzeFile', () => {
  it('detects React from imports', () => {
    const code = `import React from 'react';\nimport { useState } from 'react';`;
    const result = analyzeFile(code, 'App.tsx');
    expect(result.framework).toBe('react');
  });

  it('detects Vue from imports', () => {
    const code = `import { ref, computed } from 'vue';`;
    const result = analyzeFile(code, 'App.vue');
    expect(result.framework).toBe('vue');
  });

  it('detects Angular from imports', () => {
    const code = `import { Component } from '@angular/core';`;
    const result = analyzeFile(code, 'app.component.ts');
    expect(result.framework).toBe('angular');
  });

  it('detects Svelte from imports', () => {
    const code = `import { onMount } from 'svelte';`;
    const result = analyzeFile(code, 'App.svelte');
    expect(result.framework).toBe('svelte');
  });

  it('returns unknown for unrecognized framework', () => {
    const code = `const x = 1;`;
    const result = analyzeFile(code, 'util.ts');
    expect(result.framework).toBe('unknown');
  });

  it('counts useState correctly', () => {
    const code = `
      import { useState } from 'react';
      const [count, setCount] = useState(0);
      const [name, setName] = useState('');
      const [flag, setFlag] = useState(false);
    `;
    const result = analyzeFile(code, 'App.tsx');
    expect(result.breakdown?.stateUsages).toBe(3);
  });

  it('counts useEffect correctly', () => {
    const code = `
      import { useEffect } from 'react';
      useEffect(() => { console.log('a'); }, []);
      useEffect(() => { console.log('b'); }, [dep]);
    `;
    const result = analyzeFile(code, 'App.tsx');
    expect(result.breakdown?.effectUsages).toBe(2);
  });

  it('counts Vue ref() usages', () => {
    const code = `
      import { ref } from 'vue';
      const count = ref(0);
      const name = ref('hello');
    `;
    const result = analyzeFile(code, 'App.vue');
    expect(result.breakdown?.stateUsages).toBe(2);
  });

  it('counts Vue watch() calls', () => {
    const code = `
      import { watch } from 'vue';
      watch(count, (val) => { console.log(val); });
      watch(name, (val) => { console.log(val); });
    `;
    const result = analyzeFile(code, 'App.vue');
    expect(result.breakdown?.effectUsages).toBe(2);
  });

  it('scores complexity proportionally', () => {
    const lowCode = `
      import { useState } from 'react';
      const [a, setA] = useState(0);
    `;
    const highCode = `
      import { useState, useEffect, useContext } from 'react';
      const [a, setA] = useState(0);
      const [b, setB] = useState(0);
      const [c, setC] = useState(0);
      useEffect(() => {}, []);
      useEffect(() => {}, []);
      useEffect(() => {}, []);
      const ctx = useContext(MyCtx);
      const ctx2 = useContext(OtherCtx);
    `;
    const lowResult = analyzeFile(lowCode, 'App.tsx');
    const highResult = analyzeFile(highCode, 'App.tsx');
    expect((highResult.complexityScore ?? 0)).toBeGreaterThan((lowResult.complexityScore ?? 0));
  });

  it('complexityScore is capped at 100', () => {
    const code = `
      import { useState, useEffect, useContext } from 'react';
      ${Array(20).fill('const [x, setX] = useState(0);').join('\n')}
      ${Array(10).fill('useEffect(() => {}, []);').join('\n')}
      ${Array(10).fill('const c = useContext(X);').join('\n')}
    `;
    const result = analyzeFile(code, 'App.tsx');
    expect(result.complexityScore).toBeLessThanOrEqual(100);
  });

  it('analyzeFile works on a simple React component', () => {
    const code = `
      import React from 'react';
      import { useState, useEffect } from 'react';

      export default function Counter() {
        const [count, setCount] = useState(0);
        useEffect(() => { document.title = String(count); }, [count]);
        return <div>{count}</div>;
      }
    `;
    const result = analyzeFile(code, 'Counter.tsx');
    expect(result.framework).toBe('react');
    expect(result.breakdown?.stateUsages).toBe(1);
    expect(result.breakdown?.effectUsages).toBe(1);
    expect(result.componentCount).toBeGreaterThanOrEqual(1);
    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});

describe('analyzeProject', () => {
  it('analyzes a directory of files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'drishti-test-'));
    writeFileSync(join(dir, 'App.tsx'), `
      import { useState, useEffect } from 'react';
      export default function App() {
        const [x, setX] = useState(0);
        useEffect(() => {}, []);
        return null;
      }
    `);
    writeFileSync(join(dir, 'Button.tsx'), `
      import { useState } from 'react';
      export function Button() {
        const [hover, setHover] = useState(false);
        return null;
      }
    `);

    const result = analyzeProject(dir);
    expect(result.framework).toBe('react');
    expect(result.breakdown.stateUsages).toBe(2);
    expect(result.breakdown.effectUsages).toBe(1);
  });

  it('skips node_modules directories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'drishti-test-'));
    const nmDir = join(dir, 'node_modules', 'react');
    mkdirSync(nmDir, { recursive: true });
    writeFileSync(join(nmDir, 'index.js'), `
      import { useState } from 'react';
      const [x] = useState(0);
    `);
    writeFileSync(join(dir, 'App.tsx'), `
      import { useState } from 'react';
      export default function App() {
        const [a, setA] = useState(0);
        return null;
      }
    `);

    const result = analyzeProject(dir);
    // Should only count the one in App.tsx, not in node_modules
    expect(result.breakdown.stateUsages).toBe(1);
  });
});
