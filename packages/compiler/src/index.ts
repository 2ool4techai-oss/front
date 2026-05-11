import { tokenize } from './lexer.js';
import { Parser } from './parser.js';
import { generateSurface } from './codegen.js';
import type { SurfaceNode } from './ast.js';

export type { SurfaceNode, UnitNode, ASTNode } from './ast.js';
export { tokenize } from './lexer.js';
export { Parser, ParseError } from './parser.js';
export { generateSurface, generateDirectDOM } from './codegen.js';
export type { CodegenResult, DOMASTNode as ASTNode, ASTExpr } from './codegen.js';

export interface CompileResult {
  code: string;
  ast: SurfaceNode;
  errors: string[];
  warnings: string[];
}

export interface CompileOptions {
  runtime?:  string;
  filename?: string;
  target?:   'js' | 'ts';
}

export function compile(source: string, opts: CompileOptions = {}): CompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    const ast = parser.parseSurface();
    const code = generateSurface(ast, {
      ...(opts.runtime ? { runtime: opts.runtime } : {}),
      ...(opts.target  ? { target: opts.target }   : {}),
    });

    if (!ast.intent) {
      warnings.push(`Surface '${ast.name}' has no intent declaration — consider adding one for AI optimization`);
    }
    if (!ast.secure && ast.units.some(u => u.data)) {
      warnings.push(`Surface '${ast.name}' has data-connected units but no security directive`);
    }

    return { code, ast, errors, warnings };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { code: '', ast: { kind: 'Surface', name: 'Error', line: 0, units: [], on: [] }, errors, warnings };
  }
}
