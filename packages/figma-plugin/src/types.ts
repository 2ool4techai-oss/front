export type FigmaNodeType =
  | 'FRAME'
  | 'COMPONENT'
  | 'INSTANCE'
  | 'GROUP'
  | 'TEXT'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'VECTOR'
  | 'IMAGE'
  | 'BOOLEAN_OPERATION';

export interface FigmaColor {
  r: number;  // 0-1
  g: number;  // 0-1
  b: number;  // 0-1
  a: number;  // 0-1
}

export interface FigmaNode {
  id:       string;
  name:     string;
  type:     FigmaNodeType;
  visible?: boolean;
  children?: FigmaNode[];
  // Layout
  x?:      number;
  y?:      number;
  width?:  number;
  height?: number;
  // Text
  characters?: string;
  fontSize?:   number;
  fontWeight?: number;
  // Fills
  fills?: Array<{ type: string; color?: FigmaColor; opacity?: number }>;
  // Stroke
  strokes?: Array<{ type: string; color?: FigmaColor }>;
  strokeWeight?: number;
  // Corner radius
  cornerRadius?: number;
  // Layout
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  paddingTop?:    number;
  paddingRight?:  number;
  paddingBottom?: number;
  paddingLeft?:   number;
  itemSpacing?:   number;
  // Opacity
  opacity?: number;
}
