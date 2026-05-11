// ── Signals ────────────────────────────────────────────────────────────
export { signal, computed, effect, batch, untrack, createStore, label } from './signal.js';

// ── Dev / SSR mode (internal — prefixed with _) ────────────────────────
export { _enableDevMode, _getDevSignals, _totalEffectRuns, _setSSRMode, _setSignalWriteHook } from './signal.js';
export type { _DevSignalEntry } from './signal.js';

// ── Time Travel ────────────────────────────────────────────────────────
export { enableTimeTravel, _ttState } from './timetravel.js';
export type { TimeTravelHandle, TimeTravelEntry, TimeTravelOptions } from './timetravel.js';

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

// ── Query ──────────────────────────────────────────────────────────────
export { createQuery, createQueryMutation, invalidateQuery, invalidateAllQueries } from './query.js';
export type { QueryResult, QueryOptions, QueryStatus, MutationResult } from './query.js';

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

// ── Collaborative ──────────────────────────────────────────────────────
export { createCollabSession } from './collaborative.js';
export type { CollabHandle, CollaborativeSignal, CollabOptions, CollabOperation, PresenceState, VectorClock, CollabClientId } from './collaborative.js';

// ── Islands ────────────────────────────────────────────────────────────
export { defineIsland, hydrateIslands, getIslandRegistry, generateIslandBootstrap } from './islands.js';
export type { IslandOptions, IslandDefinition, IslandManifest } from './islands.js';

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

// ── Intent Engine ──────────────────────────────────────────────────────
export { createIntentEngine, useIntent } from './intent.js';
export type { IntentEngine, IntentEngineOptions, UserIntent, IntentSignals } from './intent.js';

// ── Playground / Stories ───────────────────────────────────────────────
export { story, getStories, clearStories } from './story.js';
export { launchPlayground } from './playground.js';
export type { StoryDefinition, StoryVariant, StoryHandle } from './story.js';
export type { PlaygroundOptions } from './playground.js';

// ── Adaptive signals ───────────────────────────────────────────────────
export { createAdaptSignal, useAdaptSignal } from './adapt.js';
export type { AdaptSignal, AdaptOptions, AdaptObservation } from './adapt.js';

// ── Resilience ────────────────────────────────────────────────────────
export { circuit, withFallback, retry, timeout } from './resilience.js';
export type { CircuitHandle, CircuitOptions, ResilienceState, RetryPolicy, BulkheadOptions } from './resilience.js';

// ── State Machines ────────────────────────────────────────────────────
export { createMachine } from './machine.js';
export type { MachineConfig, MachineHandle, MachineStateConfig, MachineTransition, MachineHistoryEntry } from './machine.js';

// ── GDPR Consent Manager ──────────────────────────────────────────────
export { createConsentManager } from './consent.js';
export type { ConsentHandle, ConsentState, ConsentOptions, ConsentCategory } from './consent.js';

// ── Server Signals ────────────────────────────────────────────────────
export { createServerSignal, createSSESignal } from './server-signal.js';
export type { ServerSignalHandle, ServerSignalState, ServerSignalOptions, ServerSignalStatus, SSESignalHandle, SSESignalOptions } from './server-signal.js';

// ── File Router ───────────────────────────────────────────────────────
export { createFileRouter } from './file-router.js';
export type { FileRoute, FileRouterOptions, FileRouterHandle } from './file-router.js';

// ── Server Functions ──────────────────────────────────────────────────
export { createServerFn } from './server-fn.js';
export type { ServerFnOptions, ServerFnHandle } from './server-fn.js';

// ── Edge Runtime ──────────────────────────────────────────────────────
export { detectPlatform, createEdgeHandler, injectState, mergeHeaders } from './edge.js';
export type { EdgeContext, EdgeRenderOptions } from './edge.js';

// ── Optimistic Updates ────────────────────────────────────────────────
export { createOptimistic } from './optimistic.js';
export type { OptimisticHandle, OptimisticOptions } from './optimistic.js';

// ── HMR ───────────────────────────────────────────────────────────────
export { captureSignalState, restoreSignalState, createHMRPlugin } from './hmr.js';
export type { HMRSignalState, HMROptions } from './hmr.js';

// ── LLM Streaming ─────────────────────────────────────────────────────
export { createLLMStream, createThinkingState, createToolCallState } from './llm.js';
export type { LLMStreamHandle, LLMStreamOptions, LLMStatus, ThinkingState, ToolCallState, ToolCall } from './llm.js';

// ── Feature Flags / A/B Testing ───────────────────────────────────────
export { createFlag, createFlagStore, createRateLimitedFlag } from './flags.js';
export type { FlagHandle, FlagConfig, FlagVariant, RateLimitedFlagOptions } from './flags.js';

// ── Advanced A/B Testing ──────────────────────────────────────────────
export { createBandit, createIntentGatedFlag, createAutoRollout } from './ab.js';
export type { BanditHandle, BanditOptions, BanditArm, BanditAlgorithm, IntentGatedOptions, IntentGatedHandle, AutoRolloutOptions, AutoRolloutHandle } from './ab.js';

// ── Session Replay ────────────────────────────────────────────────────
export { createSessionReplay } from './replay.js';
export type { ReplayHandle, ReplayOptions, ReplayEvent, ReplayEventType } from './replay.js';

// ── tRPC Adapter ──────────────────────────────────────────────────────
export { createTRPCQuery, createTRPCMutation } from './trpc.js';
export type { TRPCQueryHandle, TRPCQueryOptions, TRPCQueryStatus, TRPCMutationHandle, TRPCMutationOptions } from './trpc.js';

// ── GraphQL Adapter ───────────────────────────────────────────────────
export { createGraphQLQuery } from './graphql.js';
export type { GraphQLHandle, GraphQLOptions, GraphQLStatus } from './graphql.js';

// ── Real User Monitoring ──────────────────────────────────────────────
export { createRUM } from './rum.js';
export type { RUMHandle, RUMOptions, WebVitals } from './rum.js';

// ── Deploy Adapters ───────────────────────────────────────────────────
export { generateVercelConfig, generateNetlifyConfig, generateCloudflareConfig, generateVercelJson, generateNetlifyToml, generateWranglerToml } from './deploy.js';
export type { DeployConfig, VercelConfig, NetlifyConfig, CloudflareConfig } from './deploy.js';

// ── OpenTelemetry ─────────────────────────────────────────────────────
export { createOtelTracer } from './otel.js';
export type { OtelHandle, OtelOptions, OtelSpan } from './otel.js';

// ── Error Tracking ────────────────────────────────────────────────────
export { createErrorTracker } from './error-tracking.js';
export type { ErrorTrackingHandle, ErrorTrackingOptions, TrackedError } from './error-tracking.js';

// ── PWA / Offline ─────────────────────────────────────────────────────
export { createPWA, createOfflineQueue } from './pwa.js';
export type { PWAHandle, PWAOptions, OfflineQueueHandle, OfflineQueueOptions } from './pwa.js';

// ── CSP ───────────────────────────────────────────────────────────────
export { createCSP } from './csp.js';
export type { CSPHandle, CSPOptions, CSPDirectives } from './csp.js';
