export interface DiagnosticRule {
  id:       string;
  message:  string;
  severity: 'error' | 'warning' | 'hint';
  check:    (code: string) => DiagnosticMatch[];
}

export interface DiagnosticMatch {
  ruleId:  string;
  message: string;
  line:    number;
  column:  number;
}

export const DRISHTI_DIAGNOSTIC_RULES: DiagnosticRule[] = [
  {
    id:       'no-raw-signal-in-template',
    message:  'Use signal() not a plain value — raw values won\'t be reactive',
    severity: 'warning',
    check(code: string): DiagnosticMatch[] {
      const matches: DiagnosticMatch[] = [];
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        if (/h\([^)]*,\s*\{[^}]*:\s*[a-z_$][a-z0-9_$]*\s*[^(]/.test(line) &&
            !line.includes('signal') && !line.includes('computed') && !line.includes('() =>')) {
          matches.push({ ruleId: 'no-raw-signal-in-template', message: this.message, line: i + 1, column: 0 });
        }
      });
      return matches;
    },
  },
  {
    id:       'missing-effect-cleanup',
    message:  'Effects that set up subscriptions should return a cleanup function',
    severity: 'hint',
    check(code: string): DiagnosticMatch[] {
      const matches: DiagnosticMatch[] = [];
      const lines = code.split('\n');
      let inEffect = false;
      let effectLine = 0;
      let braceDepth = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (/\beffect\s*\(/.test(line)) { inEffect = true; effectLine = i + 1; braceDepth = 0; }
        if (inEffect) {
          braceDepth += (line.match(/\{/g) || []).length;
          braceDepth -= (line.match(/\}/g) || []).length;
          if (braceDepth <= 0 && inEffect) {
            inEffect = false;
            // Check if effect had addEventListener but no return
            const effectBlock = lines.slice(effectLine - 1, i + 1).join('\n');
            if (effectBlock.includes('addEventListener') && !effectBlock.includes('return')) {
              matches.push({ ruleId: 'missing-effect-cleanup', message: this.message, line: effectLine, column: 0 });
            }
          }
        }
      }
      return matches;
    },
  },
  {
    id:       'signal-in-conditional',
    message:  'Reading signal value inside a conditional may miss updates — use computed()',
    severity: 'warning',
    check(code: string): DiagnosticMatch[] {
      const matches: DiagnosticMatch[] = [];
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        if (/if\s*\(.*\(\).*\)/.test(line) && /\bsignal\b/.test(lines.slice(Math.max(0, i-5), i).join('\n'))) {
          matches.push({ ruleId: 'signal-in-conditional', message: this.message, line: i + 1, column: 0 });
        }
      });
      return matches;
    },
  },
];

export function runDiagnostics(code: string): DiagnosticMatch[] {
  return DRISHTI_DIAGNOSTIC_RULES.flatMap(rule => rule.check(code));
}
