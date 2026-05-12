import { signal } from './signal.js';

export interface StreamSignalOptions<T> {
  transform?: (chunk: unknown) => T;
  onDone?: () => void;
  onError?: (err: unknown) => void;
}

export interface StreamHandle<T> {
  data: () => T | undefined;
  done: () => boolean;
  error: () => unknown;
  cancel: () => void;
}

export function streamSignal<T = unknown>(
  stream: ReadableStream | (() => Promise<ReadableStream>),
  opts?: StreamSignalOptions<T>,
): StreamHandle<T> {
  const dataSig = signal<T | undefined>(undefined);
  const doneSig = signal(false);
  const errorSig = signal<unknown>(undefined);

  let reader: ReadableStreamDefaultReader<unknown> | null = null;

  async function start(): Promise<void> {
    let resolvedStream: ReadableStream;
    try {
      if (typeof stream === 'function') {
        resolvedStream = await stream();
      } else {
        resolvedStream = stream;
      }
    } catch (err) {
      errorSig.set(err);
      opts?.onError?.(err);
      return;
    }

    reader = resolvedStream.getReader() as ReadableStreamDefaultReader<unknown>;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          doneSig.set(true);
          opts?.onDone?.();
          break;
        }
        if (opts?.transform) {
          dataSig.set(opts.transform(value));
        } else {
          dataSig.set(value as T);
        }
      }
    } catch (err) {
      errorSig.set(err);
      opts?.onError?.(err);
    }
  }

  void start();

  return {
    data: dataSig,
    done: doneSig,
    error: errorSig,
    cancel(): void {
      reader?.cancel().catch(() => {
        // ignore cancel errors
      });
    },
  };
}
