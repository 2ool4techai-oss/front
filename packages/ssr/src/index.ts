import { _setSSRMode } from '@drishti/runtime';
import { createSSRContext, VNode, VDocument } from './vdom.js';
import type { SSRContext } from './vdom.js';

export type { SSRContext };
export { createSSRContext };

// ── State marker ───────────────────────────────────────────────────────
const STATE_ATTR = 'data-dr-id';
const STATE_KEY  = '__DRISHTI_STATE__';

// ── renderToString ─────────────────────────────────────────────────────
// Runs a DRISHTI component factory in a virtual DOM environment and
// returns the serialized HTML plus serialized initial state.
//
// Usage (Node.js / edge worker):
//   import { renderToString } from '@drishti/ssr';
//   const { html, stateScript } = renderToString(() => MyApp());
//   const page = `<div id="app">${html}</div>${stateScript}`;

export interface RenderResult {
  /** Serialized HTML of the component tree */
  html:         string;
  /** <script> tag to inline for client-side hydration state */
  stateScript:  string;
  /** Raw state object (if you want to serialize yourself) */
  state:        Record<string, unknown>;
}

export function renderToString(
  factory: () => unknown,
  ctx?: SSRContext,
): RenderResult {
  const context = ctx ?? createSSRContext();

  // Swap globals for the duration of rendering
  const prevDoc = (globalThis as Record<string, unknown>)['document'];
  const prevWin = (globalThis as Record<string, unknown>)['window'];

  (globalThis as Record<string, unknown>)['document'] = context.document;
  (globalThis as Record<string, unknown>)['window']   = context.window;

  // Disable effects — we only want the initial synchronous render
  _setSSRMode(true);

  let node: unknown;
  try {
    node = factory();
  } finally {
    _setSSRMode(false);
    (globalThis as Record<string, unknown>)['document'] = prevDoc;
    (globalThis as Record<string, unknown>)['window']   = prevWin;
  }

  const html = node instanceof VNode
    ? node.serialize()
    : typeof node === 'string'
      ? node
      : '';

  // Collect initial state — in a future version this could walk the signal tree;
  // for now we expose a hook-based mechanism via registerSSRState()
  const state = { ..._ssrStateRegistry };
  _ssrStateRegistry = {};

  const stateScript = Object.keys(state).length
    ? `<script>window.${STATE_KEY}=${JSON.stringify(state)}</script>`
    : '';

  return { html, stateScript, state };
}

// ── State registry (for pre-populating signals on client) ─────────────
let _ssrStateRegistry: Record<string, unknown> = {};

export function registerSSRState(key: string, value: unknown): void {
  _ssrStateRegistry[key] = value;
}

// ── hydrate ────────────────────────────────────────────────────────────
// Client-side: attaches DRISHTI to existing server-rendered DOM.
// Runs the factory (which creates signals and effects) against the
// container that was server-rendered — no DOM wiping needed since
// DRISHTI's renderer uses fine-grained DOM patches.
//
// Usage (browser entry point):
//   import { hydrate } from '@drishti/ssr';
//   hydrate(document.getElementById('app'), () => MyApp());

export function hydrate(
  container: HTMLElement,
  factory:   () => unknown,
  state?:    Record<string, unknown>,
): void {
  // Merge server state into window
  const win = window as unknown as Record<string, unknown>;
  const existing = (win[STATE_KEY] as Record<string, unknown> | undefined) ?? {};
  const merged   = { ...existing, ...state };
  win[STATE_KEY] = merged;

  // Run the component, which wires up signals to the existing DOM nodes.
  // DRISHTI's renderer diffs against existing children rather than
  // blowing them away, so first contentful paint is instant.
  const root = factory();

  if (root instanceof HTMLElement && container.children.length === 0) {
    // First render (no SSR content present) — just mount normally
    container.appendChild(root);
  }
  // If SSR content is present, signals are now wired and will patch on change.
}

// ── Islands ────────────────────────────────────────────────────────────
export { collectIslands, renderIslandPage } from './islands.js';

// ── Streaming ──────────────────────────────────────────────────────────
export { renderToStream, suspend, _clearBoundaries } from './streaming.js';
export type { StreamChunk, StreamOptions, StreamResult } from './streaming.js';
export type { ServerIslandInfo } from './islands.js';

// ── useSSRState ────────────────────────────────────────────────────────
// In a component, use this to read pre-populated server state on the client.
//
// Usage:
//   const users = signal(useSSRState<User[]>('users', []));

export function useSSRState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const win   = window as unknown as Record<string, unknown>;
  const state = win[STATE_KEY] as Record<string, unknown> | undefined;
  if (!state) return fallback;
  return (key in state ? state[key] : fallback) as T;
}
