// ── Signals ────────────────────────────────────────────────────────────
export { signal, computed, effect, batch, untrack, createStore, label } from './signal.js';

// ── Dev / SSR mode (internal — prefixed with _) ────────────────────────
export { _enableDevMode, _getDevSignals, _totalEffectRuns, _setSSRMode } from './signal.js';
export type { _DevSignalEntry } from './signal.js';

// ── Animation ──────────────────────────────────────────────────────────
export { spring, tween, stagger, interpolate, Easing } from './spring.js';

// ── Emotion ────────────────────────────────────────────────────────────
export { EmotionProcessor } from './emotion.js';

// ── Healing ────────────────────────────────────────────────────────────
export { HealingMonitor, CircuitBreaker, createErrorBoundary } from './healing.js';

// ── Security ───────────────────────────────────────────────────────────
export { ZeroTrustMesh, mesh, sanitizeHTML, sanitizeURL, sanitizeInput, sanitizeObject, SecurityError } from './security.js';

// ── Integration ────────────────────────────────────────────────────────
export { connect, connectREST, connectWS, connectSSE } from './integration.js';

// ── Genome ─────────────────────────────────────────────────────────────
export { loadGenome, loadGenomePreset, useGenome, usePalette, generatePalette, applyEmotionAdaptation, GenomePresets } from './genome.js';

// ── Renderer ───────────────────────────────────────────────────────────
export { h, text, show, each, portal, mount, mountApp } from './renderer.js';

// ── Forms ──────────────────────────────────────────────────────────────
export { createForm } from './form.js';
export type { FieldSchema, FieldState, FormState, Form, Validator } from './form.js';

// ── Performance ────────────────────────────────────────────────────────
export { memo, debounce, throttle, distinct, fromEvent, virtual, lazy, once, when } from './perf.js';
export type { VirtualListConfig, VirtualList } from './perf.js';

// ── Async data ─────────────────────────────────────────────────────────
export { createResource, createMutation, createCache } from './resource.js';
export type { Resource, ResourceOptions, ResourceStatus, Mutation, MutationOptions, MutationStatus, Cache, CacheOptions, CacheGetOptions } from './resource.js';

// ── i18n ───────────────────────────────────────────────────────────────
export { createI18n } from './i18n.js';
export type { I18nInstance, I18nOptions, Locale, Messages, MessageCatalog } from './i18n.js';

// ── Persistence ────────────────────────────────────────────────────────
export { persistSignal, createPersistedStore } from './persist.js';
export type { PersistOptions, PersistedSignal, PersistedStore } from './persist.js';

// ── Router ─────────────────────────────────────────────────────────────
export { createRouter, useRouter, setActiveRouter, Router } from './router.js';

// ── Runtime surface/unit ───────────────────────────────────────────────
export { drishti, createSurface, createUnit } from './runtime.js';

// ── Types ──────────────────────────────────────────────────────────────
export type {
  Signal,
  ComputedSignal,
  Store,
  EmotionState,
  HealMode,
  HealConfig,
  CircuitState,
  SecureConfig,
  LayoutConfig,
  FeelCondition,
  FeelRule,
  DataConfig,
  OnHandler,
  UnitDef,
  SurfaceDef,
  DrishtiUnit,
  DrishtiSurface,
  SignalSubscriber,
  Unsubscribe,
  SpringConfig,
  TweenConfig,
  SpringSignal,
  TweenSignal,
  EmotionAdaptation,
} from './types.js';

export type { GenomeConfig, ColorPalette } from './genome.js';
export type { RouteConfig, RouteLocation, RouteParams, RouteQuery, RouteGuard, RouterOptions } from './router.js';
export type { HealStatus, HealEvent, CircuitBreakerConfig, ErrorBoundaryOptions, ErrorBoundary } from './healing.js';
export type { ConnectorState, ConnectorStatus } from './integration.js';
export type { EmotionSnapshot } from './emotion.js';
