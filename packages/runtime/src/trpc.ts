import type { Signal } from './types.js';
import { signal } from './signal.js';

export interface TRPCQueryOptions<TInput, TOutput> {
  input?:           TInput;
  refetchInterval?: number;
  enabled?:         boolean;
  retry?:           number;
  onSuccess?:       (data: TOutput) => void;
  onError?:         (err: unknown) => void;
  staleTime?:       number;
}

export type TRPCQueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TRPCQueryHandle<TOutput> {
  readonly data:   Signal<TOutput | undefined>;
  readonly status: Signal<TRPCQueryStatus>;
  readonly error:  Signal<unknown>;
  refetch():       Promise<void>;
  invalidate():    void;
  setData(d: TOutput): void;
  destroy():       void;
}

export function createTRPCQuery<TInput, TOutput>(
  procedure: (input: TInput) => Promise<TOutput>,
  opts?: TRPCQueryOptions<TInput, TOutput>,
): TRPCQueryHandle<TOutput> {
  const data   = signal<TOutput | undefined>(undefined);
  const status = signal<TRPCQueryStatus>('idle');
  const error  = signal<unknown>(undefined);

  const enabled       = opts?.enabled !== false;
  const maxRetry      = opts?.retry ?? 1;
  const staleTime     = opts?.staleTime ?? 0;
  const input         = opts?.input as TInput;
  const refetchMs     = opts?.refetchInterval ?? 0;

  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;
  let isFresh = false;
  let destroyed = false;

  async function runFetch(retryLeft: number): Promise<void> {
    if (destroyed) return;
    status.set('loading');
    try {
      const result = await procedure(input);
      if (destroyed) return;
      data.set(result);
      error.set(undefined);
      status.set('success');
      isFresh = true;
      opts?.onSuccess?.(result);

      if (staleTime > 0) {
        if (staleTimer) clearTimeout(staleTimer);
        staleTimer = setTimeout(() => { isFresh = false; }, staleTime);
      }
    } catch (err) {
      if (destroyed) return;
      if (retryLeft > 0) {
        await new Promise<void>(res => setTimeout(res, 1000));
        return runFetch(retryLeft - 1);
      }
      error.set(err);
      status.set('error');
      opts?.onError?.(err);
    }
  }

  const handle: TRPCQueryHandle<TOutput> = {
    data,
    status,
    error,
    async refetch(): Promise<void> {
      isFresh = false;
      await runFetch(maxRetry);
    },
    invalidate(): void {
      isFresh = false;
      if (!destroyed) {
        void runFetch(maxRetry);
      }
    },
    setData(d: TOutput): void {
      data.set(d);
      status.set('success');
      isFresh = true;
    },
    destroy(): void {
      destroyed = true;
      if (staleTimer) clearTimeout(staleTimer);
      if (intervalTimer) clearInterval(intervalTimer);
    },
  };

  if (enabled) {
    void runFetch(maxRetry);
    if (refetchMs > 0) {
      intervalTimer = setInterval(() => { void handle.refetch(); }, refetchMs);
    }
  }

  return handle;
}

export interface TRPCMutationOptions<TInput, TOutput> {
  onSuccess?: (data: TOutput, input: TInput) => void;
  onError?:   (err: unknown, input: TInput) => void;
  onSettled?: () => void;
}

export interface TRPCMutationHandle<TInput, TOutput> {
  readonly data:    Signal<TOutput | undefined>;
  readonly loading: Signal<boolean>;
  readonly error:   Signal<unknown>;
  mutate(input: TInput): Promise<TOutput>;
  reset(): void;
}

export function createTRPCMutation<TInput, TOutput>(
  procedure: (input: TInput) => Promise<TOutput>,
  opts?: TRPCMutationOptions<TInput, TOutput>,
): TRPCMutationHandle<TInput, TOutput> {
  const data    = signal<TOutput | undefined>(undefined);
  const loading = signal<boolean>(false);
  const error   = signal<unknown>(undefined);

  return {
    data,
    loading,
    error,
    async mutate(input: TInput): Promise<TOutput> {
      loading.set(true);
      error.set(undefined);
      try {
        const result = await procedure(input);
        data.set(result);
        opts?.onSuccess?.(result, input);
        return result;
      } catch (err) {
        error.set(err);
        opts?.onError?.(err, input);
        throw err;
      } finally {
        loading.set(false);
        opts?.onSettled?.();
      }
    },
    reset(): void {
      data.set(undefined);
      error.set(undefined);
      loading.set(false);
    },
  };
}
