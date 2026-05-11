export interface LintViolation {
  line: number;
  column: number;
  messageId: string;
  message: string;
}

export interface LintRule {
  meta: {
    type: 'problem' | 'suggestion' | 'layout';
    docs: { description: string };
    messages: Record<string, string>;
  };
  check(code: string): LintViolation[];
}

// ── no-untracked-effect ────────────────────────────────────────────────
// Warn if effect(() =>) body contains .peek() — should read signal directly
export const noUntrackedEffectRule: LintRule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow .peek() inside effect() — read the signal directly instead' },
    messages: {
      noPeekInEffect: 'Avoid using .peek() inside effect(). Read the signal directly to enable tracking.',
    },
  },
  check(code: string): LintViolation[] {
    const violations: LintViolation[] = [];
    const lines = code.split('\n');

    // Find effect( blocks and check if they contain .peek()
    let inEffect = false;
    let braceDepth = 0;
    let effectStarted = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? '';

      if (!inEffect) {
        if (/effect\s*\(/.test(line)) {
          inEffect = true;
          effectStarted = true;
          braceDepth = 0;
        }
      }

      if (inEffect) {
        for (let col = 0; col < line.length; col++) {
          const ch = line[col];
          if (ch === '{') braceDepth++;
          else if (ch === '}') {
            braceDepth--;
            if (effectStarted && braceDepth <= 0) {
              inEffect = false;
              effectStarted = false;
              break;
            }
          }
        }

        // Check for .peek() in this line
        const peekMatch = line.match(/\.peek\(\)/);
        if (peekMatch && inEffect) {
          const col = line.indexOf('.peek()');
          violations.push({
            line: lineIdx + 1,
            column: col + 1,
            messageId: 'noPeekInEffect',
            message: 'Avoid using .peek() inside effect(). Read the signal directly to enable tracking.',
          });
        }
      }
    }

    return violations;
  },
};

// ── prefer-computed ────────────────────────────────────────────────────
// Warn if effect(() => { return  is found — use computed instead
export const preferComputedRule: LintRule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Prefer computed() over effect() that returns a value' },
    messages: {
      useComputed: 'Effects should not return values. Use computed() instead.',
    },
  },
  check(code: string): LintViolation[] {
    const violations: LintViolation[] = [];
    const lines = code.split('\n');

    let inEffect = false;
    let braceDepth = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? '';

      if (!inEffect) {
        if (/effect\s*\(/.test(line)) {
          inEffect = true;
          braceDepth = 0;
        }
      }

      if (inEffect) {
        for (let col = 0; col < line.length; col++) {
          const ch = line[col];
          if (ch === '{') braceDepth++;
          else if (ch === '}') {
            braceDepth--;
            if (braceDepth <= 0) {
              inEffect = false;
              break;
            }
          }
        }

        // Check for return statement inside effect
        const returnMatch = line.match(/\breturn\s+/);
        if (returnMatch && inEffect) {
          const col = line.indexOf('return');
          violations.push({
            line: lineIdx + 1,
            column: col + 1,
            messageId: 'useComputed',
            message: 'Effects should not return values. Use computed() instead.',
          });
        }
      }
    }

    return violations;
  },
};

// ── no-signal-in-condition ─────────────────────────────────────────────
// Error if `if (someSignal)` without () call — forgetting to call the signal
export const noSignalInConditionRule: LintRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow using a signal reference directly in a condition without calling it' },
    messages: {
      callSignal: 'Signal used in condition without calling it. Use signal() instead of signal.',
    },
  },
  check(code: string): LintViolation[] {
    const violations: LintViolation[] = [];
    const lines = code.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? '';

      // Match if (identifier) where identifier is not followed by ( — bare signal in condition
      // Pattern: if ( [optional spaces] identifier [optional spaces] )
      // Exclude: if (identifier()) — that's a proper call
      // Exclude: if (identifier.something) — that's a property access
      const matches = [...line.matchAll(/\bif\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g)];
      for (const match of matches) {
        // Verify the identifier isn't followed by () (not a function call)
        // The regex already ensures no parens after the identifier
        violations.push({
          line: lineIdx + 1,
          column: (match.index ?? 0) + 1,
          messageId: 'callSignal',
          message: 'Signal used in condition without calling it. Use signal() instead of signal.',
        });
      }
    }

    return violations;
  },
};

// ── no-mutate-in-render ────────────────────────────────────────────────
// Error if .set( is called in a render function
export const noMutateInRenderRule: LintRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow mutating signals inside render functions' },
    messages: {
      noMutateInRender: 'Avoid calling .set() inside render functions. Mutations should happen in event handlers or effects.',
    },
  },
  check(code: string): LintViolation[] {
    const violations: LintViolation[] = [];
    const lines = code.split('\n');

    let inRenderFn = false;
    let braceDepth = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? '';

      // Detect render function start: function render/Render/component, or arrow/const named render
      if (!inRenderFn) {
        const renderFnPattern = /(?:function\s+(?:render|Render|[A-Z][a-zA-Z0-9_$]*Component)\s*\()|(?:(?:const|let|var)\s+(?:render|Render|[A-Z][a-zA-Z0-9_$]*)\s*=\s*(?:function|\())/;
        if (renderFnPattern.test(line)) {
          inRenderFn = true;
          braceDepth = 0;
        }
      }

      if (inRenderFn) {
        for (let col = 0; col < line.length; col++) {
          const ch = line[col];
          if (ch === '{') braceDepth++;
          else if (ch === '}') {
            braceDepth--;
            if (braceDepth <= 0) {
              inRenderFn = false;
              break;
            }
          }
        }

        // Check for .set( calls inside render function
        const setMatches = [...line.matchAll(/\.set\(/g)];
        for (const match of setMatches) {
          if (inRenderFn || braceDepth > 0) {
            violations.push({
              line: lineIdx + 1,
              column: (match.index ?? 0) + 1,
              messageId: 'noMutateInRender',
              message: 'Avoid calling .set() inside render functions. Mutations should happen in event handlers or effects.',
            });
          }
        }
      }
    }

    return violations;
  },
};
