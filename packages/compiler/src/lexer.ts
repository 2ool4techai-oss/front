export type TokenKind =
  | 'KEYWORD'
  | 'IDENT'
  | 'STRING'
  | 'COLON'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'DOT'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'EQ'
  | 'NEQ'
  | 'NUMBER'
  | 'INDENT'
  | 'DEDENT'
  | 'NEWLINE'
  | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'surface', 'unit', 'intent', 'secure', 'data', 'connect',
  'feel', 'heal', 'adapt', 'predict', 'layout', 'genome',
  'on', 'columns', 'if', 'then', 'else', 'realtime',
  'auto', 'retry', 'fallback', 'role', 'authenticated',
  'celebrate', 'calm-alert', 'pulse', 'guide',
  'grid', 'flex', 'stack', 'full',
  'trending', 'positive', 'negative',
  'likely-next-action', 'user', 'history',
  'error', 'slow-network', 'breakage',
  'self-heal', 'degrade', 'block',
]);

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const lines = src.split('\n');
  const indentStack: number[] = [0];
  let line = 1;

  for (const rawLine of lines) {
    if (rawLine.trim() === '' || rawLine.trim().startsWith('#')) {
      line++;
      continue;
    }

    const indent = rawLine.search(/\S/);
    const top = indentStack[indentStack.length - 1] ?? 0;

    if (indent > top) {
      indentStack.push(indent);
      tokens.push({ kind: 'INDENT', value: '', line, col: 0 });
    } else {
      while (indent < (indentStack[indentStack.length - 1] ?? 0)) {
        indentStack.pop();
        tokens.push({ kind: 'DEDENT', value: '', line, col: 0 });
      }
    }

    tokenizeLine(rawLine.trim(), line, indent, tokens);
    tokens.push({ kind: 'NEWLINE', value: '\n', line, col: rawLine.length });
    line++;
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ kind: 'DEDENT', value: '', line, col: 0 });
  }
  tokens.push({ kind: 'EOF', value: '', line, col: 0 });
  return tokens;
}

function tokenizeLine(src: string, line: number, _startCol: number, tokens: Token[]): void {
  let i = 0;

  const peek = () => src[i] ?? '';
  const advance = () => src[i++] ?? '';

  while (i < src.length) {
    const col = i;
    const ch = peek();

    if (ch === ' ' || ch === '\t') { advance(); continue; }
    if (ch === '#') break;

    if (ch === ':') { advance(); tokens.push({ kind: 'COLON', value: ':', line, col }); continue; }
    if (ch === '(') { advance(); tokens.push({ kind: 'LPAREN', value: '(', line, col }); continue; }
    if (ch === ')') { advance(); tokens.push({ kind: 'RPAREN', value: ')', line, col }); continue; }
    if (ch === '[') { advance(); tokens.push({ kind: 'LBRACKET', value: '[', line, col }); continue; }
    if (ch === ']') { advance(); tokens.push({ kind: 'RBRACKET', value: ']', line, col }); continue; }
    if (ch === ',') { advance(); tokens.push({ kind: 'COMMA', value: ',', line, col }); continue; }
    if (ch === '.') { advance(); tokens.push({ kind: 'DOT', value: '.', line, col }); continue; }

    if (ch === '>' && src[i + 1] === '=') {
      i += 2; tokens.push({ kind: 'GTE', value: '>=', line, col }); continue;
    }
    if (ch === '<' && src[i + 1] === '=') {
      i += 2; tokens.push({ kind: 'LTE', value: '<=', line, col }); continue;
    }
    if (ch === '!' && src[i + 1] === '=') {
      i += 2; tokens.push({ kind: 'NEQ', value: '!=', line, col }); continue;
    }
    if (ch === '=' && src[i + 1] === '=') {
      i += 2; tokens.push({ kind: 'EQ', value: '==', line, col }); continue;
    }
    if (ch === '>') { advance(); tokens.push({ kind: 'GT', value: '>', line, col }); continue; }
    if (ch === '<') { advance(); tokens.push({ kind: 'LT', value: '<', line, col }); continue; }

    if (ch === '"' || ch === "'") {
      const q = advance();
      let str = '';
      while (peek() !== q && i < src.length) str += advance();
      advance();
      tokens.push({ kind: 'STRING', value: str, line, col });
      continue;
    }

    if (/\d/.test(ch)) {
      let num = '';
      while (/[\d.]/.test(peek())) num += advance();
      tokens.push({ kind: 'NUMBER', value: num, line, col });
      continue;
    }

    if (/[a-zA-Z_\-]/.test(ch)) {
      let word = '';
      while (/[a-zA-Z0-9_\-]/.test(peek())) word += advance();
      const kind: TokenKind = KEYWORDS.has(word) ? 'KEYWORD' : 'IDENT';
      tokens.push({ kind, value: word, line, col });
      continue;
    }

    advance();
  }
}
