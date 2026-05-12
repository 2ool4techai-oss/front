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

// ── Cloudflare D1/KV Signals ──────────────────────────────────────────
export { createD1Signal, createKVSignal } from './cloudflare.js';
export type { D1SignalHandle, D1SignalOptions, D1Database, KVSignalHandle, KVSignalOptions, KVNamespace } from './cloudflare.js';

// ── AI Component Generation ───────────────────────────────────────────
export { generate, generateSync } from './generate.js';
export type { GenerateOptions, GenerateResult } from './generate.js';

// ── Signal Permissions ────────────────────────────────────────────────
export { withPermissions, getAuditLog, clearAuditLog, setAIAgent, getAIAgent, PermissionError } from './permissions.js';
export type { AIAccessLevel, SignalPermissions, WrappedSignal, AuditEntry } from './permissions.js';

// ── Voice Signals ─────────────────────────────────────────────────────
export { createVoiceSignal, voiceControl } from './voice.js';
export type { VoiceSignalOptions, VoiceSignal } from './voice.js';

// ── Natural Language Queries ──────────────────────────────────────────
export { drQuery, registerQueryable, getQueryRegistry, queryLocally } from './nlquery.js';
export type { NLQueryResult, NLQueryOptions } from './nlquery.js';

// ── Semantic Signals ──────────────────────────────────────────────────
export { semanticSignal, describeAppState, getSemanticRegistry } from './semantic.js';
export type { SemanticMeta, SemanticSignalType } from './semantic.js';

// ── Offline-First Signals ─────────────────────────────────────────────
export { offlineSignal, isOnline, onceOnline } from './offline.js';
export type { OfflineSignalOptions, OfflineSignalType } from './offline.js';

// ── Predictive Routing ────────────────────────────────────────────────
export { createPredictiveRouter } from './predictive.js';
export type { PredictiveOptions, PredictiveRouter } from './predictive.js';

// ── AI Test Generation ────────────────────────────────────────────────
export { generateTestsForComponent, generateSignalTests } from './testgen.js';
export type { TestSpec } from './testgen.js';

// ── Screen Schema / UI State Capture ─────────────────────────────────
export { captureScreenSchema, registerSchemaSignal, restoreFromSchema, schemaToPrompt } from './schema.js';
export type { ScreenSchema } from './schema.js';

// ── AI Audit Trail ────────────────────────────────────────────────────
export { createAITrace, globalTrace } from './aitrace.js';
export type { AITraceEntry, AITrace, AITraceOptions } from './aitrace.js';

// ── Signal-based Code Splitting ───────────────────────────────────────
export { lazySignal, splitOn, prefetchWhen } from './lazysplit.js';
export type { LazySignalOptions, LazyStatus, LazySignalType } from './lazysplit.js';

// ── Multi-Modal Input ─────────────────────────────────────────────────
export { createMultiModalInput, adaptToModality } from './multimodal.js';
export type { InputModality, MultiModalOptions, MultiModalInput } from './multimodal.js';

// ── Cross-Session Adaptive Signals ────────────────────────────────────
export { adaptiveSignal, createLearningProfile } from './crosssession.js';
export type { LearningProfile, CrossSessionOptions, LearningProfileStore, AdaptiveSignalType } from './crosssession.js';

// ── Decaying Preference Signals ───────────────────────────────────────
export { createDecaySignal } from './decay.js';
export type { DecayOptions, DecayEntry, DecaySignal } from './decay.js';

// ── Context-Aware Profiles ────────────────────────────────────────────
export { createContextProfile, useContextAdaptiveSignal } from './context-profile.js';
export type { Context, TimeSlot, DeviceClass, NetworkClass, ContextProfileOptions, ContextProfile } from './context-profile.js';

// ── Attention Tracking ────────────────────────────────────────────────
export { createAttentionTracker } from './attention.js';
export type { AttentionOptions, AttentionEntry, AttentionTracker } from './attention.js';

// ── Explicit + Behavioral Preference Merge ────────────────────────────
export { preferenceSignal } from './preference.js';
export type { PreferenceOptions, PreferenceSignal } from './preference.js';

// ── Signal Integrity (HMAC tamper detection) ──────────────────────────
export { createIntegritySignal, IntegrityError } from './signal-integrity.js';
export type { IntegrityOptions, IntegritySignal } from './signal-integrity.js';

// ── Private / PII Signals ─────────────────────────────────────────────
export { privateSignal, isPrivateSignal, markAsPrivate, getPrivateSignals } from './private-signal.js';
export type { PIICategory, PrivateSignalOptions, PrivateSignal } from './private-signal.js';

// ── Rate-Limited Signals ──────────────────────────────────────────────
export { rateLimitSignal, RateLimitError } from './rate-limit-signal.js';
export type { RateLimitOptions, RateLimitedSignal } from './rate-limit-signal.js';

// ── XSS Guard Signals ─────────────────────────────────────────────────
export { xssGuardSignal } from './xss-guard.js';
export type { XSSGuardOptions, XSSGuardSignal } from './xss-guard.js';

// ── Anomaly Detection Signals ─────────────────────────────────────────
export { anomalySignal } from './anomaly.js';
export type { AnomalyOptions, AnomalyRule, AnomalyEvent, AnomalySignal } from './anomaly.js';

// ── Type-Coercing Signals ─────────────────────────────────────────────
export { coercedSignal } from './type-coerce.js';
export type { CoerceOptions, CoerceTarget, CoercedSignal } from './type-coerce.js';

// ── Dead Signal Detector ──────────────────────────────────────────────
export { createDeadSignalDetector, watchedSignal } from './dead-signal.js';
export type { DeadSignalOptions, DeadSignalReport, DeadSignalDetector } from './dead-signal.js';

// ── Circular Dependency Guard ─────────────────────────────────────────
export { guardedComputed, detectCycles, CircularDependencyError } from './circular-guard.js';
export type { CircularGuardOptions, GuardedComputed } from './circular-guard.js';

// ── Bounded Array Signals ─────────────────────────────────────────────
export { boundedSignal } from './bounded-signal.js';
export type { BoundedOptions, BoundedSignal } from './bounded-signal.js';
