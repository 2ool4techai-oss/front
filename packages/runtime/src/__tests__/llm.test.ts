import { describe, it, expect, vi } from 'vitest';
import { createLLMStream, createThinkingState, createToolCallState } from '../llm.js';

describe('createLLMStream', () => {
  it('starts idle', () => {
    const handle = createLLMStream();
    expect(handle.status()).toBe('idle');
    expect(handle.text()).toBe('');
    expect(handle.tokens()).toBe(0);
  });

  it('append() adds to text signal', () => {
    const handle = createLLMStream();
    handle.append('Hello');
    expect(handle.text()).toBe('Hello');
    handle.append(' World');
    expect(handle.text()).toBe('Hello World');
  });

  it('reset() clears text and tokens', () => {
    const handle = createLLMStream();
    handle.append('some text');
    handle.reset();
    expect(handle.text()).toBe('');
    expect(handle.tokens()).toBe(0);
    expect(handle.status()).toBe('idle');
  });

  it('done computed is true when status=done', () => {
    const handle = createLLMStream();
    expect(handle.done()).toBe(false);
    handle.abort();
    expect(handle.done()).toBe(true);
  });

  it('stream() from AsyncIterable accumulates text', async () => {
    const handle = createLLMStream();
    async function* gen(): AsyncIterable<string> {
      yield 'Hello';
      yield ' ';
      yield 'World';
    }
    await handle.stream(gen());
    expect(handle.text()).toBe('Hello World');
    expect(handle.status()).toBe('done');
  });

  it('abort() sets status done', () => {
    const handle = createLLMStream();
    handle.abort();
    expect(handle.status()).toBe('done');
  });

  it('onToken callback called per append', () => {
    const onToken = vi.fn();
    const handle  = createLLMStream({ onToken });
    handle.append('foo');
    handle.append('bar');
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, 'foo');
    expect(onToken).toHaveBeenNthCalledWith(2, 'bar');
  });

  it('onDone called after stream completes', async () => {
    const onDone = vi.fn();
    const handle = createLLMStream({ onDone });
    async function* gen(): AsyncIterable<string> {
      yield 'done!';
    }
    await handle.stream(gen());
    expect(onDone).toHaveBeenCalledWith('done!');
  });
});

describe('createThinkingState', () => {
  it('startThinking sets thinking=true', () => {
    const state = createThinkingState();
    expect(state.thinking()).toBe(false);
    state.startThinking();
    expect(state.thinking()).toBe(true);
  });

  it('stopThinking sets thinking=false', () => {
    const state = createThinkingState();
    state.startThinking();
    state.stopThinking();
    expect(state.thinking()).toBe(false);
  });
});

describe('createToolCallState', () => {
  it('add() pushes to calls', () => {
    const state = createToolCallState();
    expect(state.calls()).toHaveLength(0);
    state.add({ id: '1', name: 'search', args: { q: 'hello' }, result: null });
    expect(state.calls()).toHaveLength(1);
    expect(state.calls()[0]?.name).toBe('search');
    expect(state.calls()[0]?.status).toBe('pending');
  });

  it('update() patches by id', () => {
    const state = createToolCallState();
    state.add({ id: '1', name: 'search', args: {}, result: null });
    state.update('1', { status: 'done', result: { data: 42 } });
    const call = state.calls().find((c) => c.id === '1');
    expect(call?.status).toBe('done');
    expect(call?.result).toEqual({ data: 42 });
  });
});
