# Changelog

All notable changes to DRISHTI will be documented in this file.

## [0.1.0] — 2026-05-11

### Added — Core

- Fine-grained signals with `signal()`, `computed()`, `effect()`, `batch()`, `untrack()`
- Signal labeling and dev mode introspection via `label()`, `_enableDevMode()`
- Time-travel debugging with `enableTimeTravel()` — snapshot/restore/replay
- Signal write hook (`_setSignalWriteHook`) for framework-level instrumentation

### Added — State & Data

- XState-inspired state machines via `createMachine()`
- Reactive resource/mutation/cache layer (`createResource`, `createMutation`, `createCache`)
- Query layer with invalidation (`createQuery`, `createQueryMutation`, `invalidateQuery`)
- Optimistic updates with rollback (`createOptimistic`)
- Signal persistence (`persistSignal`, `createPersistedStore`)

### Added — Networking & Real-time

- WebSocket signals with auto-reconnect (`createWSSignal`)
- SSE signals (`createSSESignal`, `createServerSignal`)
- Web Worker signals (`createWorkerSignal`)
- Service Worker cache strategies (`createSWSignal`)
- Collaborative CRDT signals (`createCollabSession`)
- Server functions with caching (`createServerFn`)
- tRPC adapter (`createTRPCQuery`, `createTRPCMutation`)
- GraphQL adapter (`createGraphQLQuery`)

### Added — UI & Components

- Renderer: `h()`, `text()`, `show()`, `each()`, `portal()`, `mount()`, `mountApp()`
- 20+ components: Button, Input, Modal, Select, Switch, Slider, RadioGroup, FileUpload, Chart, Drawer, Stepper, NotificationCenter, InfiniteScroll, Kanban, RichTextEditor, VirtualList, Tooltip, Toast, CollabCursors
- Islands architecture with 4 hydration strategies (`defineIsland`, `hydrateIslands`)
- Animation: `spring()`, `tween()`, `stagger()`, `interpolate()`

### Added — Developer Experience

- TypeScript-first, strict mode throughout
- ESLint plugin with 4 custom rules (`@nexoraaidrishti/eslint-plugin`)
- Component testing library with `render()`, `fireEvent`, `waitFor()`, `waitForSignal()`
- WCAG 2.2 accessibility audit (`auditA11y`, `assertA11y`, 18+ rules)
- Visual regression testing (`takeSnapshot`, `diffSnapshots`, `assertVisualMatch`)
- Signal assertions for Vitest (`expectSignal`, `setupSignalMatchers`)
- CLI with 11 commands (`create`, `add`, `build`, `dev`, `preview`, `analyze`, `doctor`, etc.)
- Vite HMR plugin (`createHMRPlugin`)
- Tailwind CSS plugin (`drishtiTailwindPlugin`)

### Added — Production Features

- OpenTelemetry tracing (`createOtelTracer`)
- Real User Monitoring (`createRUM`) — LCP, FCP, CLS, FID, TTFB
- Session replay (`createSessionReplay`)
- Error tracking with signal snapshots (`createErrorTracker`)
- Audit logging with ring buffer (`createAuditLog`)
- HIPAA-compliant PII scrubbing (`enableHIPAA`)
- CSP nonce management (`createCSP`)
- PWA/offline queue (`createPWA`, `createOfflineQueue`)
- GDPR consent manager (`createConsentManager`)
- Feature flags / A/B testing with multi-armed bandit (`createFlag`, `createBandit`)
- Rate-limited flags (`createRateLimitedFlag`)

### Added — Infrastructure

- SSR with streaming and suspend boundaries (`renderToString`, `renderToStream`, `createSuspense`)
- Edge runtime adapter (`detectPlatform`, `createEdgeHandler`)
- Cloudflare D1/KV signals (`createD1Signal`, `createKVSignal`)
- Deploy adapters for Vercel, Netlify, Cloudflare Workers
- File router (`createFileRouter`)
- i18n (`createI18n`)
- Router (`createRouter`, `useRouter`)

### Added — Apps & Tooling

- `apps/todo/` — working TodoMVC demo
- `apps/docs/` — documentation site built with DRISHTI itself
- `packages/create-app/` — `create-drishti-app` scaffold
- `packages/migrate/` — migration codemods from React/Vue
- `packages/devtools-extension/` — Chrome/Firefox DevTools extension
- `packages/vscode-extension/` — VS Code snippets, diagnostics, hover info
- `packages/electron/` — Electron main/renderer signal bridge
- `packages/capacitor/` — Capacitor mobile adapter (iOS/Android)

### Tests

- 800+ tests across 11+ packages
- Runtime: 455 tests
- Components: 141 tests
- Testing library: 62 tests
- SSR: 33 tests
- CLI: 24 tests
- Migrate: 36 tests
- ESLint plugin: 12 tests
- Tailwind plugin: 10 tests
- Create-app: 10 tests
