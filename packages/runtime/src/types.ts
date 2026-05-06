export type EmotionState =
  | 'calm'
  | 'engaged'
  | 'focused'
  | 'frustrated'
  | 'confused'
  | 'bored'
  | 'celebrating';

export type HealMode = 'auto' | 'retry' | 'fallback';
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface HealConfig {
  mode: HealMode;
  retries?: number;
  fallback?: string;
}

export interface SecureConfig {
  requirement: string;
  args: string[];
}

export interface LayoutConfig {
  type: string;
  value?: string;
}

export interface FeelCondition {
  left: string;
  op: 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte' | 'truthy';
  right?: string;
}

export interface FeelRule {
  emotion: string;
  condition?: FeelCondition;
}

export interface DataConfig {
  source: string;
  realtime: boolean;
}

export interface OnHandler {
  event: string;
  action: string;
}

export interface UnitDef {
  name: string;
  data?: DataConfig;
  columns?: string[];
  feel?: FeelRule[];
  heal?: HealConfig;
  secure?: SecureConfig;
  adapt?: string;
  predict?: string;
  layout?: LayoutConfig;
  on?: OnHandler[];
  props?: Record<string, string>;
}

export interface SurfaceDef {
  intent?: string;
  secure?: SecureConfig;
  genome?: Record<string, string>;
  layout?: LayoutConfig;
  on?: OnHandler[];
  units: UnitDef[];
}

export interface DrishtiUnit {
  def: UnitDef;
  el: HTMLElement;
  state: Signal<unknown>;
  emotion: Signal<EmotionState>;
  destroy: () => void;
}

export interface DrishtiSurface {
  def: SurfaceDef;
  el: HTMLElement;
  units: DrishtiUnit[];
  destroy: () => void;
}

export type SignalSubscriber<T> = (value: T) => void;
export type Unsubscribe = () => void;

export interface Signal<T> {
  (): T;
  set(value: T): void;
  subscribe(fn: SignalSubscriber<T>): Unsubscribe;
  peek(): T;
}

export interface ComputedSignal<T> {
  (): T;
  readonly isComputed: true;
  peek(): T;
  set(_: T): void;
  subscribe(fn: SignalSubscriber<T>): Unsubscribe;
}

// ── Store ──────────────────────────────────────────────────────────────
export interface Store<T extends Record<string, unknown>> {
  get(): T;
  set(patch: Partial<T>): void;
  select<K extends keyof T>(key: K): ComputedSignal<T[K]>;
  readonly signal: Signal<T>;
  reset(): void;
}

// ── Spring / Tween ─────────────────────────────────────────────────────
export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  precision?: number;
}

export interface TweenConfig {
  duration?: number;
  easing?: (t: number) => number;
}

export interface SpringSignal {
  (): number;
  to(target: number): void;
  set(value: number): void;
  peek(): number;
  subscribe(fn: SignalSubscriber<number>): Unsubscribe;
  stop(): void;
  destroy(): void;
}

export interface TweenSignal {
  (): number;
  to(target: number): void;
  set(value: number): void;
  peek(): number;
  subscribe(fn: SignalSubscriber<number>): Unsubscribe;
  stop(): void;
  destroy(): void;
}

// ── Genome adaptation ──────────────────────────────────────────────────
export interface EmotionAdaptation {
  animationSpeed: number;
  borderRadius: number;
  shadowIntensity: number;
  saturation: number;
  blurStrength: number;
  spacingScale: number;
}
