import { signal } from './signal.js';
import type { Signal } from './types.js';

export interface WorkerSignalOptions<TInput, TOutput> {
  onError?: (err: ErrorEvent) => void;
  timeout?: number;
}

export interface WorkerSignalHandle<TInput, TOutput> {
  readonly result:  Signal<TOutput | undefined>;
  readonly loading: Signal<boolean>;
  readonly error:   Signal<unknown>;
  run(input: TInput): Promise<TOutput>;
  terminate(): void;
}

export function createWorkerSignal<TInput, TOutput>(
  workerFn: (input: TInput) => TOutput | Promise<TOutput>,
  opts?: WorkerSignalOptions<TInput, TOutput>,
): WorkerSignalHandle<TInput, TOutput> {
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
