import type { CodemodResult } from './react.js';

export type { CodemodResult };

function getLineNumber(code: string, index: number): number {
  return code.slice(0, index).split('\n').length;
}

export function transformVue(code: string, _filename?: string): CodemodResult {
  let result = code;
  const changes: Array<{ line: number; from: string; to: string }> = [];
  const warnings: string[] = [];
  const manualReviewNeeded: string[] = [];

  // 1. Transform Vue imports → Drishti imports
  {
    const pattern = /^import\s*\{[^}]*\}\s*from\s*['"]vue['"];?$/m;
    const match = pattern.exec(result);
    if (match && match.index !== undefined) {
      const from = match[0];
      const to = "import { signal, computed, effect } from '@nexoraaidrishti/runtime'";
      const lineNum = getLineNumber(result, match.index);
      result = result.replace(pattern, to);
      changes.push({ line: lineNum, from, to });
    }
  }

  // 2. Transform: const foo = ref(init) → const foo = signal(init)
  {
    const pattern = /\bconst\s+(\w+)\s*=\s*ref\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      const varName = match[1];
      const init = match[2];
      const from = match[0];
      const to = `const ${varName} = signal(${init})`;
      replacements.push({ from, to, index: match.index });
    }
    for (let i = replacements.length - 1; i >= 0; i--) {
      const rep = replacements[i];
      if (rep === undefined) continue;
      const lineNum = getLineNumber(result, rep.index);
      result = result.slice(0, rep.index) + rep.to + result.slice(rep.index + rep.from.length);
      changes.push({ line: lineNum, from: rep.from, to: rep.to });
    }
  }

  // 3. Transform: foo.value = x → foo.set(x) (write)
  {
    const pattern = /\b(\w+)\.value\s*=\s*([^;\n]+)/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      const varName = match[1] ?? '';
      const value = (match[2] ?? '').trim();
      const from = match[0];
      const to = `${varName}.set(${value})`;
      replacements.push({ from, to, index: match.index });
    }
    for (let i = replacements.length - 1; i >= 0; i--) {
      const rep = replacements[i];
      if (rep === undefined) continue;
      const lineNum = getLineNumber(result, rep.index);
      result = result.slice(0, rep.index) + rep.to + result.slice(rep.index + rep.from.length);
      changes.push({ line: lineNum, from: rep.from, to: rep.to });
    }
    if (replacements.length > 0) {
      manualReviewNeeded.push('.value writes converted to .set() — verify correctness');
    }
  }

  // 4. Transform: foo.value → foo() (read — must come after write transform)
  {
    const pattern = /\b(\w+)\.value\b/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      const varName = match[1];
      const from = match[0];
      const to = `${varName}()`;
      replacements.push({ from, to, index: match.index });
    }
    for (let i = replacements.length - 1; i >= 0; i--) {
      const rep = replacements[i];
      if (rep === undefined) continue;
      const lineNum = getLineNumber(result, rep.index);
      result = result.slice(0, rep.index) + rep.to + result.slice(rep.index + rep.from.length);
      changes.push({ line: lineNum, from: rep.from, to: rep.to });
    }
  }

  // 5. Transform: const bar = computed(() => ...) stays the same (no-op but record)
  // Actually computed stays identical — just note it passes through

  // 6. Transform: watch(foo, (val) => ...) → effect(() => { const val = foo(); ... })
  {
    const pattern = /\bwatch\s*\(\s*(\w+)\s*,\s*\((\w+)\)\s*=>\s*(\{[^}]*\}|[^,)]+)\s*\)/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      const watchedVar = match[1] ?? '';
      const param = match[2] ?? '';
      const body = (match[3] ?? '').trim();
      const from = match[0];
      let effectBody: string;
      if (body.startsWith('{')) {
        // Remove surrounding braces to inline
        const inner = body.slice(1, -1).trim();
        effectBody = `{ const ${param} = ${watchedVar}(); ${inner} }`;
      } else {
        effectBody = `{ const ${param} = ${watchedVar}(); ${body} }`;
      }
      const to = `effect(() => ${effectBody})`;
      replacements.push({ from, to, index: match.index });
    }
    for (let i = replacements.length - 1; i >= 0; i--) {
      const rep = replacements[i];
      if (rep === undefined) continue;
      const lineNum = getLineNumber(result, rep.index);
      result = result.slice(0, rep.index) + rep.to + result.slice(rep.index + rep.from.length);
      changes.push({ line: lineNum, from: rep.from, to: rep.to });
    }
  }

  // 7. Transform: onMounted(() => ...) → // Run on mount:\n(() => { ... })()
  {
    const pattern = /\bonMounted\s*\(\s*\(\s*\)\s*=>\s*(\{[^}]*\})\s*\)/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      const body = match[1];
      const from = match[0];
      const to = `// Run on mount:\n(() => ${body})()`;
      replacements.push({ from, to, index: match.index });
    }
    for (let i = replacements.length - 1; i >= 0; i--) {
      const rep = replacements[i];
      if (rep === undefined) continue;
      const lineNum = getLineNumber(result, rep.index);
      result = result.slice(0, rep.index) + rep.to + result.slice(rep.index + rep.from.length);
      changes.push({ line: lineNum, from: rep.from, to: rep.to });
    }
  }

  // 8. Transform: reactive({ ... }) → createStore({ ... })
  {
    const pattern = /\breactive\s*\(/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      replacements.push({ from: match[0], to: 'createStore(', index: match.index });
    }
    for (let i = replacements.length - 1; i >= 0; i--) {
      const rep = replacements[i];
      if (rep === undefined) continue;
      const lineNum = getLineNumber(result, rep.index);
      result = result.slice(0, rep.index) + rep.to + result.slice(rep.index + rep.from.length);
      changes.push({ line: lineNum, from: rep.from, to: rep.to });
    }
    if (replacements.length > 0) {
      warnings.push('reactive() converted to createStore() — ensure @nexoraaidrishti/runtime exports createStore');
    }
  }

  return { code: result, changes, warnings, manualReviewNeeded };
}
