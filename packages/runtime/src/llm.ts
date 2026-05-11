import { signal, computed, batch } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type LLMStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface LLMStreamOptions {
  onToken?:   (token: string) => void;
  onDone?:    (full: string) => void;
  onError?:   (err: unknown) => void;
  transform?: (chunk: string) => string;
}

export interface LLMStreamHandle {
  readonly text:   Signal<string>;
  readonly status: Signal<LLMStatus>;
  readonly tokens: Signal<number>;
  readonly done:   ComputedSignal<boolean>;
  stream(source: ReadableStream<Uint8Array> | AsyncIterable<string>): Promise<void>;
  append(text: string): void;
  reset(): void;
  abort(): void;
}

// ── createLLMStream ────────────────────────────────────────────────────

export function createLLMStream(opts?: LLMStreamOptions): LLMStreamHandle {
  const text   = signal('');
  const status = signal<LLMStatus>('idle');
  const tokens = signal(0);
  const done   = computed(() => status() === 'done');

  let abortController: AbortController | null = null;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  function append(chunk: string): void {
    const transformed = opts?.transform ? opts.transform(chunk) : chunk;
    batch(() => {
      text.set(text.peek() + transformed);
      tokens.set(tokens.peek() + 1);
    });
    opts?.onToken?.(transformed);
  }

  function reset(): void {
    batch(() => {
      text.set('');
      status.set('idle');
      tokens.set(0);
    });
  }

  function abort(): void {
    abortController?.abort();
    if (currentReader) {
      currentReader.cancel().catch(() => {/* ignore */});
      currentReader = null;
    }
    status.set('done');
  }

  async function stream(
    source: ReadableStream<Uint8Array> | AsyncIterable<string>,
  ): Promise<void> {
    abortController = new AbortController();
    const signal_ = abortController.signal;

    status.set('streaming');

    try {
      if (Symbol.asyncIterator in source) {
        // AsyncIterable<string>
        for await (const chunk of source as AsyncIterable<string>) {
          if (signal_.aborted) break;
          append(chunk);
        }
      } else {
        // ReadableStream<Uint8Array>
        const rs = source as ReadableStream<Uint8Array>;
        const reader = rs.getReader();
        currentReader = reader;
        const decoder = new TextDecoder();

        try {
          while (true) {
            if (signal_.aborted) break;
            const { done: rdDone, value } = await reader.read();
            if (rdDone) break;
            const chunk = decoder.decode(value, { stream: true });
            append(chunk);
          }
        } finally {
          currentReader = null;
          reader.releaseLock();
        }
      }

      if (!signal_.aborted) {
        status.set('done');
        opts?.onDone?.(text.peek());
      }
    } catch (err) {
      if (!signal_.aborted) {
        status.set('error');
        opts?.onError?.(err);
      }
    }
  }

  return { text, status, tokens, done, stream, append, reset, abort };
}

// ── ThinkingState ──────────────────────────────────────────────────────

export interface ThinkingState {
  thinking: Signal<boolean>;
  thought:  Signal<string>;
  startThinking(label?: string): void;
  stopThinking(): void;
}

export function createThinkingState(): ThinkingState {
  const thinking = signal(false);
  const thought  = signal('');

  function startThinking(label?: string): void {
    batch(() => {
      thinking.set(true);
      if (label !== undefined) thought.set(label);
    });
  }

  function stopThinking(): void {
    thinking.set(false);
  }

  return { thinking, thought, startThinking, stopThinking };
}

// ── ToolCallState ──────────────────────────────────────────────────────

export interface ToolCall {
  id:     string;
  name:   string;
  args:   Record<string, unknown>;
  result: unknown;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface ToolCallState {
  calls: Signal<ToolCall[]>;
  add(call: Omit<ToolCall, 'status'>): void;
  update(id: string, patch: Partial<ToolCall>): void;
  clear(): void;
}

export function createToolCallState(): ToolCallState {
  const calls = signal<ToolCall[]>([]);

  function add(call: Omit<ToolCall, 'status'>): void {
    const newCall: ToolCall = { ...call, status: 'pending' };
    calls.set([...calls.peek(), newCall]);
  }

  function update(id: string, patch: Partial<ToolCall>): void {
    calls.set(
      calls.peek().map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function clear(): void {
    calls.set([]);
  }

  return { calls, add, update, clear };
}
