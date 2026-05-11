import type { Signal } from './types.js';
import { signal } from './signal.js';

export interface GraphQLOptions<TData, TVariables> {
  variables?:       TVariables;
  headers?:         Record<string, string>;
  refetchInterval?: number;
  enabled?:         boolean;
  onSuccess?:       (data: TData) => void;
  onError?:         (err: unknown) => void;
}

export type GraphQLStatus = 'idle' | 'loading' | 'success' | 'error';

export interface GraphQLHandle<TData> {
  readonly data:   Signal<TData | undefined>;
  readonly status: Signal<GraphQLStatus>;
  readonly error:  Signal<unknown>;
  refetch():       Promise<void>;
  setVariables(v: unknown): void;
  destroy():       void;
}

export function createGraphQLQuery<TData, TVariables = Record<string, unknown>>(
  endpoint: string,
  query: string,
  opts?: GraphQLOptions<TData, TVariables>,
): GraphQLHandle<TData> {
  const data   = signal<TData | undefined>(undefined);
  const status = signal<GraphQLStatus>('idle');
  const error  = signal<unknown>(undefined);

  let variables: unknown = opts?.variables;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;

  async function doFetch(): Promise<void> {
    if (destroyed) return;
    status.set('loading');
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(opts?.headers ?? {}),
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json() as { data?: TData; errors?: unknown[] };
      if (json.errors && json.errors.length > 0) {
        throw new Error(JSON.stringify(json.errors));
      }
      const result = json.data as TData;
      if (destroyed) return;
      data.set(result);
      status.set('success');
      opts?.onSuccess?.(result);
    } catch (err) {
      if (destroyed) return;
      error.set(err);
      status.set('error');
      opts?.onError?.(err);
    }
  }

  const handle: GraphQLHandle<TData> = {
    data,
    status,
    error,
    async refetch(): Promise<void> {
      await doFetch();
    },
    setVariables(v: unknown): void {
      variables = v;
      void doFetch();
    },
    destroy(): void {
      destroyed = true;
      if (intervalTimer) clearInterval(intervalTimer);
    },
  };

  const enabled = opts?.enabled !== false;
  if (enabled) {
    void doFetch();
    const refetchMs = opts?.refetchInterval ?? 0;
    if (refetchMs > 0) {
      intervalTimer = setInterval(() => { void doFetch(); }, refetchMs);
    }
  }

  return handle;
}
