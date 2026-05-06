import type { Token, TokenKind } from './lexer.js';
import type {
  SurfaceNode, UnitNode, DataConnectNode, FeelRuleNode,
  HealDirectiveNode, SecureDirectiveNode, LayoutDirectiveNode,
  AdaptDirectiveNode, PredictDirectiveNode, GenomeDirectiveNode,
  OnDirectiveNode, ConditionNode,
} from './ast.js';

export class ParseError extends Error {
  constructor(msg: string, public line: number) {
    super(`[DRISHTI Parser] Line ${line}: ${msg}`);
  }
}

export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset] ?? { kind: 'EOF', value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new ParseError('Unexpected end of input', 0);
    this.pos++;
    return t;
  }

  private expect(kind: TokenKind, value?: string): Token {
    const t = this.advance();
    if (t.kind !== kind || (value !== undefined && t.value !== value)) {
      throw new ParseError(`Expected ${kind}${value ? `(${value})` : ''}, got ${t.kind}(${t.value})`, t.line);
    }
    return t;
  }

  private match(kind: TokenKind, value?: string): boolean {
    const t = this.peek();
    return t.kind === kind && (value === undefined || t.value === value);
  }

  private skipNewlines(): void {
    while (this.match('NEWLINE')) this.advance();
  }

  parseSurface(): SurfaceNode {
    this.skipNewlines();
    const kw = this.expect('KEYWORD', 'surface');
    this.expect('COLON');
    const name = this.advance();
    this.skipNewlines();

    const node: SurfaceNode = {
      kind: 'Surface',
      name: name.value,
      line: kw.line,
      units: [],
      on: [],
    };

    if (!this.match('INDENT')) return node;
    this.advance();
    this.skipNewlines();

    while (!this.match('DEDENT') && !this.match('EOF')) {
      const t = this.peek();
      if (t.kind === 'NEWLINE') { this.advance(); continue; }

      if (t.kind === 'KEYWORD') {
        switch (t.value) {
          case 'intent': node.intent = this.parseSimpleValue('intent'); break;
          case 'secure': node.secure = this.parseSecure(); break;
          case 'layout': node.layout = this.parseLayout(); break;
          case 'genome': node.genome = node.genome ?? []; node.genome.push(this.parseGenome()); break;
          case 'on': node.on.push(this.parseOn()); break;
          case 'unit': node.units.push(this.parseUnit()); break;
          default: this.skipLine(); break;
        }
      } else {
        this.skipLine();
      }
      this.skipNewlines();
    }

    if (this.match('DEDENT')) this.advance();
    return node;
  }

  private parseUnit(): UnitNode {
    const kw = this.expect('KEYWORD', 'unit');
    this.expect('COLON');
    const name = this.advance();
    this.skipNewlines();

    const node: UnitNode = {
      kind: 'Unit',
      name: name.value,
      line: kw.line,
      feel: [],
      on: [],
      props: {},
    };

    if (!this.match('INDENT')) return node;
    this.advance();
    this.skipNewlines();

    while (!this.match('DEDENT') && !this.match('EOF')) {
      const t = this.peek();
      if (t.kind === 'NEWLINE') { this.advance(); continue; }

      if (t.kind === 'KEYWORD' || t.kind === 'IDENT') {
        switch (t.value) {
          case 'data': node.data = this.parseData(); break;
          case 'feel': node.feel.push(this.parseFeel()); break;
          case 'heal': node.heal = this.parseHeal(); break;
          case 'secure': node.secure = this.parseSecure(); break;
          case 'adapt': node.adapt = this.parseAdapt(); break;
          case 'predict': node.predict = this.parsePredict(); break;
          case 'layout': node.layout = this.parseLayout(); break;
          case 'on': node.on.push(this.parseOn()); break;
          case 'columns': node.columns = this.parseColumns(); break;
          default: {
            const key = this.advance().value;
            if (this.match('COLON')) {
              this.advance();
              node.props[key] = this.collectRestOfLine();
            } else {
              this.skipLine();
            }
            break;
          }
        }
      } else {
        this.skipLine();
      }
      this.skipNewlines();
    }

    if (this.match('DEDENT')) this.advance();
    return node;
  }

  private parseData(): DataConnectNode {
    const kw = this.advance();
    this.expect('COLON');
    let realtime = false;
    let source = '';

    if (this.match('KEYWORD', 'connect') || this.match('IDENT', 'connect')) {
      this.advance();
      this.expect('LPAREN');
      source = this.collectUntil('RPAREN', 'COMMA');
      if (this.match('COMMA')) {
        this.advance();
        const opt = this.advance();
        if (opt.value === 'realtime') realtime = true;
      }
      this.expect('RPAREN');
    } else {
      source = this.collectRestOfLine();
    }

    return { kind: 'DataConnect', source: source.trim(), realtime, line: kw.line };
  }

  private parseFeel(): FeelRuleNode {
    const kw = this.advance();
    this.expect('COLON');
    const emotion = this.advance().value;
    let condition: ConditionNode | null = null;

    if (this.match('KEYWORD', 'if') || this.match('IDENT', 'if')) {
      this.advance();
      condition = this.parseCondition(kw.line);
    }

    this.skipLine();
    return { kind: 'FeelRule', emotion, condition, line: kw.line };
  }

  private parseCondition(line: number): ConditionNode {
    const left = this.collectConditionOperand();
    const op = this.peek();

    if (op.kind === 'GT') {
      this.advance();
      const right = this.collectConditionOperand();
      return { kind: 'Condition', left, operator: 'gt', right, line };
    }
    if (op.kind === 'LT') {
      this.advance();
      const right = this.collectConditionOperand();
      return { kind: 'Condition', left, operator: 'lt', right, line };
    }
    if (op.kind === 'GTE') {
      this.advance();
      const right = this.collectConditionOperand();
      return { kind: 'Condition', left, operator: 'gte', right, line };
    }
    if (op.kind === 'LTE') {
      this.advance();
      const right = this.collectConditionOperand();
      return { kind: 'Condition', left, operator: 'lte', right, line };
    }
    if (op.kind === 'EQ') {
      this.advance();
      const right = this.collectConditionOperand();
      return { kind: 'Condition', left, operator: 'eq', right, line };
    }
    if (op.kind === 'NEQ') {
      this.advance();
      const right = this.collectConditionOperand();
      return { kind: 'Condition', left, operator: 'neq', right, line };
    }

    return { kind: 'Condition', left, operator: 'truthy', line };
  }

  private collectConditionOperand(): string {
    let result = '';
    while (!this.match('NEWLINE') && !this.match('EOF') &&
           this.peek().kind !== 'GT' && this.peek().kind !== 'LT' &&
           this.peek().kind !== 'GTE' && this.peek().kind !== 'LTE' &&
           this.peek().kind !== 'EQ' && this.peek().kind !== 'NEQ') {
      const t = this.advance();
      if (t.kind === 'DOT') { result += '.'; continue; }
      result += (result && !result.endsWith('.') ? ' ' : '') + t.value;
    }
    return result.trim();
  }

  private parseHeal(): HealDirectiveNode {
    const kw = this.advance();
    this.expect('COLON');
    const mode = this.advance();

    if (mode.value === 'auto') {
      this.skipLine();
      return { kind: 'HealDirective', mode: 'auto', line: kw.line };
    }
    if (mode.value === 'retry') {
      let retries = 3;
      let fallbackLabel: string | undefined;
      if (this.match('LPAREN')) {
        this.advance();
        retries = parseInt(this.advance().value, 10);
        this.expect('RPAREN');
      }
      if (this.match('KEYWORD', 'then') || this.match('IDENT', 'then')) {
        this.advance();
        fallbackLabel = this.advance().value;
      }
      this.skipLine();
      return { kind: 'HealDirective', mode: 'retry', retries, fallbackLabel, line: kw.line };
    }

    this.skipLine();
    return { kind: 'HealDirective', mode: 'fallback', line: kw.line };
  }

  private parseSecure(): SecureDirectiveNode {
    const kw = this.advance();
    this.expect('COLON');
    const req = this.advance();
    const args: string[] = [];

    if (this.match('LPAREN')) {
      this.advance();
      while (!this.match('RPAREN') && !this.match('EOF')) {
        if (this.match('COMMA')) { this.advance(); continue; }
        args.push(this.advance().value);
      }
      if (this.match('RPAREN')) this.advance();
    }

    this.skipLine();
    return { kind: 'SecureDirective', requirement: req.value, args, line: kw.line };
  }

  private parseLayout(): LayoutDirectiveNode {
    const kw = this.advance();
    this.expect('COLON');
    const type = this.advance();
    let value: string | undefined;

    if (this.match('LPAREN')) {
      this.advance();
      value = this.advance().value;
      if (this.match('RPAREN')) this.advance();
    }

    this.skipLine();
    return { kind: 'LayoutDirective', type: type.value, value, line: kw.line };
  }

  private parseAdapt(): AdaptDirectiveNode {
    const kw = this.advance();
    this.expect('COLON');
    const source = this.collectRestOfLine();
    return { kind: 'AdaptDirective', source: source.trim(), line: kw.line };
  }

  private parsePredict(): PredictDirectiveNode {
    const kw = this.advance();
    this.expect('COLON');
    const target = this.collectRestOfLine();
    return { kind: 'PredictDirective', target: target.trim(), line: kw.line };
  }

  private parseGenome(): GenomeDirectiveNode {
    const kw = this.advance();
    this.expect('COLON');
    const key = this.advance().value;
    this.expect('COLON');
    const value = this.collectRestOfLine();
    return { kind: 'GenomeDirective', key, value: value.trim(), line: kw.line };
  }

  private parseOn(): OnDirectiveNode {
    const kw = this.advance();
    this.expect('COLON');
    const event = this.collectUntil('NEWLINE', 'EOF', 'KEYWORD');
    let action = '';
    if (this.peek().kind === 'KEYWORD' || this.peek().kind === 'IDENT') {
      action = this.collectRestOfLine();
    }
    return { kind: 'OnDirective', event: event.trim(), action: action.trim(), line: kw.line };
  }

  private parseColumns(): string[] {
    this.advance();
    this.expect('COLON');
    this.expect('LBRACKET');
    const cols: string[] = [];
    while (!this.match('RBRACKET') && !this.match('EOF')) {
      if (this.match('COMMA')) { this.advance(); continue; }
      if (this.match('NEWLINE')) { this.advance(); continue; }
      cols.push(this.advance().value);
    }
    if (this.match('RBRACKET')) this.advance();
    this.skipLine();
    return cols;
  }

  private parseSimpleValue(keyword: string): string {
    this.advance();
    this.expect('COLON');
    return this.collectRestOfLine().trim();
  }

  private collectUntil(...stopKinds: TokenKind[]): string {
    let result = '';
    while (!stopKinds.includes(this.peek().kind) && !this.match('EOF')) {
      const t = this.advance();
      result += t.value + ' ';
    }
    return result.trim();
  }

  private collectRestOfLine(): string {
    let result = '';
    while (!this.match('NEWLINE') && !this.match('EOF') &&
           !this.match('DEDENT') && !this.match('INDENT')) {
      const t = this.advance();
      if (t.kind === 'DOT') { result += '.'; continue; }
      result += (result && !result.endsWith('.') ? ' ' : '') + t.value;
    }
    return result;
  }

  private skipLine(): void {
    while (!this.match('NEWLINE') && !this.match('EOF') &&
           !this.match('DEDENT')) {
      this.advance();
    }
  }
}
