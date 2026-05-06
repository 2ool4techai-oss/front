export type NodeKind =
  | 'Surface'
  | 'Unit'
  | 'DataConnect'
  | 'FeelRule'
  | 'HealDirective'
  | 'SecureDirective'
  | 'LayoutDirective'
  | 'AdaptDirective'
  | 'PredictDirective'
  | 'GenomeDirective'
  | 'OnDirective'
  | 'Identifier'
  | 'StringLiteral'
  | 'CallExpr'
  | 'MemberExpr'
  | 'Condition';

export interface BaseNode {
  kind: NodeKind;
  line: number;
}

export interface StringLiteralNode extends BaseNode {
  kind: 'StringLiteral';
  value: string;
}

export interface IdentifierNode extends BaseNode {
  kind: 'Identifier';
  name: string;
}

export interface MemberExprNode extends BaseNode {
  kind: 'MemberExpr';
  object: string;
  property: string;
}

export interface CallExprNode extends BaseNode {
  kind: 'CallExpr';
  callee: string;
  args: string[];
  options?: Record<string, string>;
}

export interface ConditionNode extends BaseNode {
  kind: 'Condition';
  left: string;
  operator: 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte' | 'truthy';
  right?: string;
}

export interface DataConnectNode extends BaseNode {
  kind: 'DataConnect';
  source: string;
  realtime: boolean;
}

export interface FeelRuleNode extends BaseNode {
  kind: 'FeelRule';
  emotion: string;
  condition: ConditionNode | null;
}

export interface HealDirectiveNode extends BaseNode {
  kind: 'HealDirective';
  mode: 'auto' | 'retry' | 'fallback';
  retries?: number | undefined;
  fallbackLabel?: string | undefined;
}

export interface SecureDirectiveNode extends BaseNode {
  kind: 'SecureDirective';
  requirement: string;
  args: string[];
}

export interface LayoutDirectiveNode extends BaseNode {
  kind: 'LayoutDirective';
  type: string;
  value?: string | undefined;
}

export interface AdaptDirectiveNode extends BaseNode {
  kind: 'AdaptDirective';
  source: string;
}

export interface PredictDirectiveNode extends BaseNode {
  kind: 'PredictDirective';
  target: string;
}

export interface GenomeDirectiveNode extends BaseNode {
  kind: 'GenomeDirective';
  key: string;
  value: string;
}

export interface OnDirectiveNode extends BaseNode {
  kind: 'OnDirective';
  event: string;
  action: string;
}

export interface UnitNode extends BaseNode {
  kind: 'Unit';
  name: string;
  data?: DataConnectNode;
  columns?: string[];
  feel: FeelRuleNode[];
  heal?: HealDirectiveNode;
  secure?: SecureDirectiveNode;
  adapt?: AdaptDirectiveNode;
  predict?: PredictDirectiveNode;
  layout?: LayoutDirectiveNode;
  on: OnDirectiveNode[];
  props: Record<string, string>;
}

export interface SurfaceNode extends BaseNode {
  kind: 'Surface';
  name: string;
  intent?: string;
  secure?: SecureDirectiveNode;
  genome?: GenomeDirectiveNode[];
  layout?: LayoutDirectiveNode;
  units: UnitNode[];
  on: OnDirectiveNode[];
}

export type ASTNode =
  | SurfaceNode
  | UnitNode
  | DataConnectNode
  | FeelRuleNode
  | HealDirectiveNode
  | SecureDirectiveNode
  | LayoutDirectiveNode
  | AdaptDirectiveNode
  | PredictDirectiveNode
  | GenomeDirectiveNode
  | OnDirectiveNode
  | ConditionNode
  | IdentifierNode
  | StringLiteralNode
  | CallExprNode
  | MemberExprNode;
