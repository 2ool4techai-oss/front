import { signal } from './signal.js';
import type { Signal } from './types.js';

// ── workerSignal ────────────────────────────────────────────────────────

export interface WorkerSignalOptions<TInput, TOutput> {
  worker: Worker | (() => Worker);
  transfer?: (input: TInput) => Transferable[];
  timeout?: number;
  onError?: (err: ErrorEvent | Error) => void;
  serialize?: (v: TInput) => unknown;
  deserialize?: (v: unknown) => TOutput;
}

export interface WorkerSignalHandle<TInput, TOutput> {
  result: () => TOutput | undefined;
  loading: () => boolean;
  error: () => Error | null;
  run: (input: TInput) => void;
  terminate: () => void;
}

export function workerSignal<TInput = unknown, TOutput = unknown>(
  opts: WorkerSignalOptions<TInput, TOutput>,
): WorkerSignalHandle<TInput, TOutput> {
  const resultSig = signal<TOutput | undefined>(undefined);
  const loadingSig = signal<boolean>(false);
  const errorSig = signal<Error | null>(null);

  const worker: Worker = typeof opts.worker === 'function' ? opts.worker() : opts.worker;

  const serialize = opts.serialize ?? ((v: TInput) => v as unknown);
  const deserialize = opts.deserialize ?? ((v: unknown) => v as TOutput);
  const timeoutMs = opts.timeout ?? 30_000;

  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timeoutTimer !== null) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  };

  worker.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data as { type: string; payload?: unknown; message?: string };
    if (msg.type === 'result') {
      clearTimer();
      resultSig.set(deserialize(msg.payload));
      loadingSig.set(false);
    } else if (msg.type === 'error') {
      clearTimer();
      errorSig.set(new Error(msg.message ?? 'Worker error'));
      loadingSig.set(false);
    }
  });

  worker.onerror = (e: ErrorEvent) => {
    clearTimer();
    errorSig.set(new Error(e.message ?? 'Worker error'));
    loadingSig.set(false);
    opts.onError?.(e);
  };

  return {
    result: () => resultSig(),
    loading: () => loadingSig(),
    error: () => errorSig(),

    run(input: TInput): void {
      loadingSig.set(true);
      errorSig.set(null);

      const payload = serialize(input);
      const transferables = opts.transfer ? opts.transfer(input) : [];

      if (timeoutMs > 0) {
        clearTimer();
        timeoutTimer = setTimeout(() => {
          timeoutTimer = null;
          const err = new Error(`Worker timed out after ${timeoutMs}ms`);
          errorSig.set(err);
          loadingSig.set(false);
          opts.onError?.(err);
        }, timeoutMs);
      }

      if (transferables.length > 0) {
        worker.postMessage({ type: 'run', payload }, transferables);
      } else {
        worker.postMessage({ type: 'run', payload });
      }
    },

    terminate(): void {
      clearTimer();
      worker.terminate();
    },
  };
}

// ── createInlineWorker ──────────────────────────────────────────────────

export function createInlineWorker(fn: (input: unknown) => unknown): Worker {
  const code = `self.onmessage = async function(e) {
  try {
    const fn = ${fn.toString()};
    const result = await Promise.resolve(fn(e.data.payload));
    self.postMessage({ type: 'result', payload: result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};`;
  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

export interface CreateWorkerSignalOptions<TInput, TOutput> {
  onError?: (err: ErrorEvent) => void;
  timeout?: number;
}

export interface CreateWorkerSignalHandle<TInput, TOutput> {
  readonly result:  Signal<TOutput | undefined>;
  readonly loading: Signal<boolean>;
  readonly error:   Signal<unknown>;
  run(input: TInput): Promise<TOutput>;
  terminate(): void;
}

export function createWorkerSignal<TInput, TOutput>(
  workerFn: (input: TInput) => TOutput | Promise<TOutput>,
  opts?: CreateWorkerSignalOptions<TInput, TOutput>,
): CreateWorkerSignalHandle<TInput, TOutput> {
  const result  = signal<TOutput | undefined>(undefined);
  const loading = signal<boolean>(false);
  const error   = signal<unknown>(undefined);

  let worker: Worker | null = null;
  let blobUrl: string | null = null;

  if (typeof Worker !== 'undefined') {
    const code = `self.onmessage = async (e) => {
  try {
    const fn = ${workerFn.toString()};
    const result = await Promise.resolve(fn(e.data));
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
}`;
    const blob = new Blob([code], { type: 'application/javascript' });
    blobUrl = URL.createObjectURL(blob);
    worker = new Worker(blobUrl);

    worker.onerror = (e: ErrorEvent) => {
      loading.set(false);
      error.set(e);
      opts?.onError?.(e);
    };
  }

  let pendingResolve: ((val: TOutput) => void) | null = null;
  let pendingReject:  ((err: unknown) => void) | null = null;
  let timeoutTimer:   ReturnType<typeof setTimeout> | null = null;

  if (worker) {
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: TOutput; error?: string }>) => {
      if (timeoutTimer !== null) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      loading.set(false);
      if (e.data.ok) {
        const res = e.data.result as TOutput;
        result.set(res);
        error.set(undefined);
        pendingResolve?.(res);
      } else {
        const err = new Error(e.data.error ?? 'Worker error');
        error.set(err);
        pendingReject?.(err);
      }
      pendingResolve = null;
      pendingReject  = null;
    };
  }

  return {
    result,
    loading,
    error,

    run(input: TInput): Promise<TOutput> {
      return new Promise<TOutput>((resolve, reject) => {
        if (!worker) {
          reject(new Error('Worker not available'));
          return;
        }
        pendingResolve = resolve;
        pendingReject  = reject;
        loading.set(true);

        const timeoutMs = opts?.timeout ?? 0;
        if (timeoutMs > 0) {
          timeoutTimer = setTimeout(() => {
            timeoutTimer = null;
            loading.set(false);
            const err = new Error(`Worker timed out after ${timeoutMs}ms`);
            error.set(err);
            pendingResolve = null;
            pendingReject  = null;
            reject(err);
          }, timeoutMs);
        }

        worker.postMessage(input);
      });
    },

    terminate(): void {
      if (timeoutTimer !== null) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      if (worker) {
        worker.terminate();
        worker = null;
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    },
  };
}
