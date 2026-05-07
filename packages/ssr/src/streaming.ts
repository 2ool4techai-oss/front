import { _setSSRMode } from '@drishti/runtime';
import { VNode, createSSRContext } from './vdom.js';
import type { SSRContext } from './vdom.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface StreamChunk {
  /** Unique ID for this suspense boundary */
  id:      string;
  /** Rendered HTML for this chunk */
  html:    string;
  /** True if this is the final chunk */
  done:    boolean;
  /** Error if this chunk failed */
  error?:  string;
}

export interface StreamOptions {
  /** Fallback HTML shown while async content loads */
  fallback?:       string;
  /** Context to use for rendering */
  ctx?:            SSRContext;
  /** Called when a chunk is ready */
  onChunk?:        (chunk: StreamChunk) => void;
  /** Abort signal to cancel streaming */
  signal?:         AbortSignal;
  /** Bootstrap script to append at end */
  bootstrapScript?: string;
}

export interface StreamResult {
  /** Readable stream of HTML chunks (works in Node and edge runtimes) */
  stream:          ReadableStream<string>;
  /** Promise that resolves when all chunks have been sent */
  allReady:        Promise<void>;
  /** Abort streaming */
  abort():         void;
}

// ── Suspense boundary ──────────────────────────────────────────────────

interface SuspenseBoundary {
  id:        string;
  promise:   Promise<unknown>;
  fallback:  string;
  onResolve: (html: string) => void;
  onReject:  (err: Error) => void;
}

let _boundaries: SuspenseBoundary[] = [];
let _boundaryCounter = 0;

/**
 * Wrap async content in a suspense boundary.
 * During SSR, renders the fallback immediately and streams the real
 * content once the promise resolves.
 *
 * @example
 * const userSection = suspend(
 *   fetchUser(id).then(user => UserCard({ user })),
 *   '<div class="skeleton">Loading user...</div>'
 * );
 */
export function suspend<T extends VNode | string>(
  promise: Promise<T>,
  fallback = '<span data-dr-fallback></span>',
): VNode {
  const id = `dr-s-${++_boundaryCounter}`;
  const ctx = createSSRContext();

  // Create a placeholder VNode that will be replaced by streaming content
  const placeholder = ctx.document.createElement('div') as unknown as VNode;
  placeholder.setAttribute('data-dr-suspense', id);
  placeholder.setAttribute('data-dr-fallback', '');

  // Set fallback content as innerHTML
  placeholder.innerHTML = fallback;

  // Register the boundary — the stream renderer will pick this up
  _boundaries.push({
    id,
    promise: promise as Promise<unknown>,
    fallback,
    onResolve: () => {},
    onReject: () => {},
  });

  return placeholder;
}

/** Clear boundary registry (call at start of each request) */
export function _clearBoundaries(): void {
  _boundaries = [];
  _boundaryCounter = 0;
}

/** Get current boundaries (used by renderToStream) */
export function _getBoundaries(): readonly SuspenseBoundary[] {
  return _boundaries;
}

// ── renderToStream ─────────────────────────────────────────────────────

export function renderToStream(
  factory: () => unknown,
  opts?:   StreamOptions,
): StreamResult {
  _clearBoundaries();

  const ctx = opts?.ctx ?? createSSRContext();
  let _aborted = false;
  let _controller!: ReadableStreamDefaultController<string>;

  const stream = new ReadableStream<string>({
    start(controller) { _controller = controller; },
  });

  let allReadyResolve!: () => void;
  let allReadyReject!:  (e: unknown) => void;
  const allReady = new Promise<void>((res, rej) => {
    allReadyResolve = res;
    allReadyReject  = rej;
  });

  // Render the shell synchronously
  const prevDoc = (globalThis as Record<string, unknown>)['document'];
  const prevWin = (globalThis as Record<string, unknown>)['window'];
  (globalThis as Record<string, unknown>)['document'] = ctx.document;
  (globalThis as Record<string, unknown>)['window']   = ctx.window;
  _setSSRMode(true);

  let shellHtml = '';
  let shellBoundaries: SuspenseBoundary[] = [];

  try {
    const node = factory();
    shellHtml = node instanceof VNode
      ? node.serialize()
      : typeof node === 'string' ? node : '';
    shellBoundaries = [..._getBoundaries()];
  } finally {
    _setSSRMode(false);
    (globalThis as Record<string, unknown>)['document'] = prevDoc;
    (globalThis as Record<string, unknown>)['window']   = prevWin;
  }

  // Enqueue the shell immediately
  const shell = `<div id="dr-shell">${shellHtml}</div>`;
  _controller.enqueue(shell + '\n');

  if (shellBoundaries.length === 0) {
    // No async boundaries — we're done
    if (opts?.bootstrapScript) _controller.enqueue(opts.bootstrapScript + '\n');
    _controller.close();
    allReadyResolve();
  } else {
    // Stream each boundary as it resolves
    let remaining = shellBoundaries.length;

    for (const boundary of shellBoundaries) {
      boundary.promise
        .then((result) => {
          if (_aborted) return;

          let chunkHtml: string;
          if (result instanceof VNode) {
            chunkHtml = result.serialize();
          } else if (typeof result === 'string') {
            chunkHtml = result;
          } else {
            chunkHtml = '';
          }

          // Inline script to replace the placeholder
          const replaceScript = `<script>
(function(){
  var el = document.querySelector('[data-dr-suspense="${boundary.id}"]');
  if(el){ var t = document.createElement('template'); t.innerHTML = ${JSON.stringify(chunkHtml)}; el.replaceWith(t.content); }
})();
</script>`;

          _controller.enqueue(chunkHtml + replaceScript + '\n');
          opts?.onChunk?.({ id: boundary.id, html: chunkHtml, done: false });

          remaining--;
          if (remaining === 0) {
            if (opts?.bootstrapScript) _controller.enqueue(opts.bootstrapScript + '\n');
            _controller.close();
            allReadyResolve();
          }
        })
        .catch((err: unknown) => {
          if (_aborted) return;
          const msg = err instanceof Error ? err.message : String(err);
          const errHtml = `<!-- streaming error: ${msg} -->`;
          _controller.enqueue(errHtml + '\n');
          opts?.onChunk?.({ id: boundary.id, html: errHtml, done: false, error: msg });

          remaining--;
          if (remaining === 0) {
            if (opts?.bootstrapScript) _controller.enqueue(opts.bootstrapScript + '\n');
            _controller.close();
            allReadyResolve();
          }
        });
    }
  }

  return {
    stream,
    allReady,
    abort() {
      _aborted = true;
      _controller.close();
      allReadyReject(new Error('aborted'));
    },
  };
}
