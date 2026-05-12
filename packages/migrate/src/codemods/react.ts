export interface CodemodResult {
  code: string;
  changes: Array<{ line: number; from: string; to: string }>;
  warnings: string[];
  manualReviewNeeded: string[];
}

function getLineNumber(code: string, index: number): number {
  return code.slice(0, index).split('\n').length;
}

export function transformReact(code: string, _filename?: string): CodemodResult {
  let result = code;
  const changes: Array<{ line: number; from: string; to: string }> = [];
  const warnings: string[] = [];
  const manualReviewNeeded: string[] = [];

  // Track JSX presence
  const hasJSX =
    /<[A-Z][a-zA-Z0-9]*[\s/>]/.test(result) ||
    /<[a-z]+[\s/>]/.test(result) ||
    /\/>/g.test(result) ||
    /<\/[a-zA-Z]/.test(result);

  if (hasJSX) {
    manualReviewNeeded.push('JSX syntax detected — convert JSX to Drishti template manually');
  }

  // 1. Transform: import React from 'react'
  {
    const pattern = /^import React from ['"]react['"];?$/m;
    const match = pattern.exec(result);
    if (match && match.index !== undefined) {
      const from = match[0];
      const to = '// Drishti (no React import needed)';
      const lineNum = getLineNumber(result, match.index);
      result = result.replace(pattern, to);
      changes.push({ line: lineNum, from, to });
    }
  }

  // 2. Transform: import { useState, useEffect, ... } from 'react'
  {
    const pattern = /^import\s*\{[^}]*\}\s*from\s*['"]react['"];?$/m;
    const match = pattern.exec(result);
    if (match && match.index !== undefined) {
      const from = match[0];
      const to = "import { signal, effect, computed } from '@nexoraaidrishti/runtime'";
      const lineNum = getLineNumber(result, match.index);
      result = result.replace(pattern, to);
      changes.push({ line: lineNum, from, to });
    }
  }

  // 3. Transform: const [foo, setFoo] = useState(init)
  {
    const pattern = /const\s+\[(\w+),\s*set(\w+)\]\s*=\s*useState\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    // Collect all matches first to avoid index drift
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      const varName = match[1];
      const init = match[3];
      const from = match[0];
      const to = `const ${varName} = signal(${init})`;
      replacements.push({ from, to, index: match.index });
    }
    // Apply in reverse order to preserve indices
    for (let i = replacements.length - 1; i >= 0; i--) {
      const rep = replacements[i];
      if (rep === undefined) continue;
      const lineNum = getLineNumber(result, rep.index);
      result = result.slice(0, rep.index) + rep.to + result.slice(rep.index + rep.from.length);
      changes.push({ line: lineNum, from: rep.from, to: rep.to });
    }
  }

  // 4. Transform: setFoo(value) → foo.set(value) — best effort, flag for review
  {
    const pattern = /\bset([A-Z]\w*)\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      const cap = match[1] ?? '';
      const args = match[2] ?? '';
      const firstChar = cap[0] ?? '';
      const varName = firstChar.toLowerCase() + cap.slice(1);
      const from = match[0];
      const to = `${varName}.set(${args})`;
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
      manualReviewNeeded.push('setState calls converted best-effort to signal.set() — verify variable names match');
    }
  }

  // 5. Transform: useEffect(() => { ... }, []) → effect(() => { ... })
  {
    const pattern = /\buseEffect\s*\(/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      replacements.push({ from: match[0], to: 'effect(', index: match.index });
    }
    for (let i = replacements.length - 1; i >= 0; i--) {
      const rep = replacements[i];
      if (rep === undefined) continue;
      const lineNum = getLineNumber(result, rep.index);
      result = result.slice(0, rep.index) + rep.to + result.slice(rep.index + rep.from.length);
      changes.push({ line: lineNum, from: rep.from, to: rep.to });
    }
    // Remove dependency array argument: , [deps]) at end of effect calls
    result = result.replace(/\(effect\s*\(\s*\(\s*\)\s*=>\s*\{([^}]*)\}\s*,\s*\[[^\]]*\]\s*\)/g, (m, _body) => m);
    // Simpler: strip trailing , [...] from effect(...)
    result = result.replace(/\beffect\((\s*\(\s*\)\s*=>(?:\s*\{[^}]*\}|\s*[^,;)]+))\s*,\s*\[[^\]]*\]\s*\)/g, 'effect($1)');
  }

  // Remove dependency arrays after arrow functions in effect calls (second arg [deps])
  // Already handled above with broad pattern

  // 6. Transform: useMemo(() => expr, [deps]) → computed(() => expr)
  {
    const pattern = /\buseMemo\s*\(\s*((?:\([^)]*\)|[^,])*?)\s*,\s*\[[^\]]*\]\s*\)/g;
    let match: RegExpExecArray | null;
    const replacements: Array<{ from: string; to: string; index: number }> = [];
    while ((match = pattern.exec(result)) !== null) {
      const fn = match[1];
      const from = match[0];
      const to = `computed(${fn})`;
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

  // 7. React.createElement → flag for manual review
  if (/\bReact\.createElement\s*\(/.test(result)) {
    manualReviewNeeded.push('React.createElement() calls detected — convert to Drishti h() or template syntax manually');
    warnings.push('React.createElement() is not automatically transformable');
  }

  // 8. export default function MyComponent → add Island comment
  {
    const pattern = /^(export default (?:async )?function\s+[A-Z][a-zA-Z0-9]*)/m;
    const match = pattern.exec(result);
    if (match && match.index !== undefined && match[1] !== undefined) {
      const from = match[1];
      const to = `// Island: eager\n${match[1]}`;
      const lineNum = getLineNumber(result, match.index);
      result = result.replace(pattern, to);
      changes.push({ line: lineNum, from, to });
    }
  }

  return { code: result, changes, warnings, manualReviewNeeded };
}
