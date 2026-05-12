import { describe, it, expect, vi } from 'vitest';
import { streamSignal } from '../stream-signal.js';

function makeStream<T>(chunks: T[], errorAfter?: number): ReadableStream<T> {
  let index = 0;
  return new ReadableStream<T>({
    pull(controller) {
      if (errorAfter !== undefined && index >= errorAfter) {
        controller.error(new Error('stream error'));
        return;
      }
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    },
  });
}

describe('streamSignal', () => {
  it('each chunk updates data()', async () => {
    const stream = makeStream([1, 2, 3]);
    const handle = streamSignal<number>(stream);

    // Wait for stream to complete
    await new Promise<void>((resolve) => {
      const check = () => {
        if (handle.done()) resolve();
        else setTimeout(check, 10);
      };
      check();
    });

    expect(handle.data()).toBe(3);
  });

  it('done() becomes true after stream ends', async () => {
    const stream = makeStream(['a', 'b']);
    const handle = streamSignal<string>(stream);

    await new Promise<void>((resolve) => {
      const check = () => {
        if (handle.done()) resolve();
        else setTimeout(check, 10);
      };
      check();
    });

    expect(handle.done()).toBe(true);
  });

  it('done() starts as false', () => {
    // Use a stream that never closes to check initial state
    let controller: ReadableStreamDefaultController<number>;
    const stream = new ReadableStream<number>({
      start(c) {
        controller = c;
      },
    });
    const handle = streamSignal<number>(stream);
    expect(handle.done()).toBe(false);
    controller!.close();
  });

  it('onDone callback is called when stream ends', async () => {
    const onDone = vi.fn();
    const stream = makeStream([1]);
    const handle = streamSignal<number>(stream, { onDone });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (handle.done()) resolve();
        else setTimeout(check, 10);
      };
      check();
    });

    expect(onDone).toHaveBeenCalledOnce();
  });

  it('transform function is applied to chunks', async () => {
    const stream = makeStream([1, 2, 3]);
    const transform = (chunk: unknown) => (chunk as number) * 10;
    const handle = streamSignal<number>(stream, { transform });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (handle.done()) resolve();
        else setTimeout(check, 10);
      };
      check();
    });

    expect(handle.data()).toBe(30);
  });

  it('error() is set when stream errors', async () => {
    const stream = makeStream([1, 2], 1); // error after first chunk
    const onError = vi.fn();
    const handle = streamSignal<number>(stream, { onError });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (handle.error() !== undefined) resolve();
        else setTimeout(check, 10);
      };
      check();
    });

    expect(handle.error()).toBeInstanceOf(Error);
    expect((handle.error() as Error).message).toBe('stream error');
    expect(onError).toHaveBeenCalledOnce();
  });

  it('cancel() works without throwing', async () => {
    let controller: ReadableStreamDefaultController<number>;
    const stream = new ReadableStream<number>({
      start(c) {
        controller = c;
      },
    });
    const handle = streamSignal<number>(stream);
    // Give the async read loop time to start
    await Promise.resolve();
    expect(() => handle.cancel()).not.toThrow();
    // After cancel(), the stream is already cancelled — closing the controller
    // may throw ERR_INVALID_STATE, so we guard against it
    try { controller!.close(); } catch { /* already closed by cancel */ }
  });

  it('accepts a factory function that returns a Promise<ReadableStream>', async () => {
    const factory = async () => makeStream([10, 20]);
    const handle = streamSignal<number>(factory);

    await new Promise<void>((resolve) => {
      const check = () => {
        if (handle.done()) resolve();
        else setTimeout(check, 10);
      };
      check();
    });

    expect(handle.data()).toBe(20);
    expect(handle.done()).toBe(true);
  });

  it('data() starts as undefined', () => {
    let controller: ReadableStreamDefaultController<number>;
    const stream = new ReadableStream<number>({
      start(c) {
        controller = c;
      },
    });
    const handle = streamSignal<number>(stream);
    expect(handle.data()).toBeUndefined();
    controller!.close();
  });

  it('error() starts as undefined', () => {
    let controller: ReadableStreamDefaultController<number>;
    const stream = new ReadableStream<number>({
      start(c) {
        controller = c;
      },
    });
    const handle = streamSignal<number>(stream);
    expect(handle.error()).toBeUndefined();
    controller!.close();
  });
});
