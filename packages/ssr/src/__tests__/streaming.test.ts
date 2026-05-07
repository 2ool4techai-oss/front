import { describe, it, expect } from 'vitest';
import { renderToStream, suspend, _clearBoundaries } from '../streaming.js';
import { createSSRContext, VNode } from '../vdom.js';

// Helper to collect all chunks from a ReadableStream
async function collect(stream: ReadableStream<string>): Promise<string[]> {
  const chunks: string[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe('renderToStream', () => {
  it('renders shell HTML immediately as first chunk', async () => {
    const { stream, allReady } = renderToStream(() => {
      const ctx = createSSRContext();
      const div = ctx.document.createElement('div');
      div.textContent = 'Hello Shell';
      return div;
    });

    const chunks = await collect(stream);
    await allReady;

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]).toContain('Hello Shell');
    expect(chunks[0]).toContain('dr-shell');
  });

  it('streams async boundary content when promise resolves', async () => {
    const { stream, allReady } = renderToStream(() => {
      const ctx = createSSRContext();
      const wrapper = ctx.document.createElement('div');
      const boundary = suspend(
        Promise.resolve('<p>Async content</p>'),
        '<p>Loading...</p>',
      );
      wrapper.appendChild(boundary);
      return wrapper;
    });

    const chunks = await collect(stream);
    await allReady;

    const combined = chunks.join('');
    expect(combined).toContain('Async content');
    // The async chunk should come after the shell
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('renders fallback HTML in shell for async boundaries', async () => {
    const { stream, allReady } = renderToStream(() => {
      const ctx = createSSRContext();
      const wrapper = ctx.document.createElement('div');
      const boundary = suspend(
        new Promise<string>(() => {}), // never resolves in this test context
        '<div class="skeleton">Loading user...</div>',
      );
      wrapper.appendChild(boundary);
      return wrapper;
    });

    // Read just the first (shell) chunk
    const reader = stream.getReader();
    const { value: shellChunk } = await reader.read();
    reader.releaseLock();

    expect(shellChunk).toContain('Loading user...');
    expect(shellChunk).toContain('data-dr-suspense');

    // Clean up by aborting
    // allReady won't resolve since the promise never resolves
    // Just check the shell chunk was correct
    allReady.catch(() => {}); // suppress unhandled rejection
  });

  it('multiple boundaries stream independently', async () => {
    let resolve1!: (v: string) => void;
    let resolve2!: (v: string) => void;
    const p1 = new Promise<string>(r => { resolve1 = r; });
    const p2 = new Promise<string>(r => { resolve2 = r; });

    const { stream, allReady } = renderToStream(() => {
      const ctx = createSSRContext();
      const wrapper = ctx.document.createElement('div');
      wrapper.appendChild(suspend(p1, '<span>Loading 1</span>'));
      wrapper.appendChild(suspend(p2, '<span>Loading 2</span>'));
      return wrapper;
    });

    // Resolve both
    resolve1('<p>Content 1</p>');
    resolve2('<p>Content 2</p>');

    const chunks = await collect(stream);
    await allReady;

    const combined = chunks.join('');
    expect(combined).toContain('Content 1');
    expect(combined).toContain('Content 2');
    // Should have shell + 2 async chunks
    expect(chunks.length).toBe(3);
  });

  it('handles boundary promise rejection gracefully', async () => {
    const { stream, allReady } = renderToStream(() => {
      suspend(
        Promise.reject(new Error('fetch failed')),
        '<p>Loading...</p>',
      );
      return '<div>shell</div>';
    });

    const chunks = await collect(stream);
    await allReady;

    const combined = chunks.join('');
    expect(combined).toContain('<!-- streaming error: fetch failed -->');
  });

  it('abort() closes the stream early', async () => {
    let resolveP!: (v: string) => void;
    const p = new Promise<string>(r => { resolveP = r; });

    const { stream, allReady, abort } = renderToStream(() => {
      suspend(p, '<p>Loading...</p>');
      return '<div>shell</div>';
    });

    // Read the shell chunk
    const reader = stream.getReader();
    const { value: shellChunk } = await reader.read();
    expect(shellChunk).toContain('dr-shell');

    // Abort before the promise resolves
    abort();

    // allReady should reject
    await expect(allReady).rejects.toThrow('aborted');

    // Stream should be closed — next read should be done
    const { done } = await reader.read();
    expect(done).toBe(true);

    reader.releaseLock();
    resolveP('too late');
  });

  it('allReady resolves after all chunks sent', async () => {
    let resolved = false;

    const { stream, allReady } = renderToStream(() => {
      suspend(Promise.resolve('<p>Async</p>'), '<p>Loading</p>');
      return '<div>shell</div>';
    });

    allReady.then(() => { resolved = true; });

    // Before consuming, allReady should not be resolved yet
    await Promise.resolve(); // tick

    const chunks = await collect(stream);
    await allReady;

    expect(resolved).toBe(true);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('bootstrapScript is appended at end', async () => {
    const bootstrapScript = '<script src="/app.js"></script>';

    const { stream, allReady } = renderToStream(
      () => '<div>content</div>',
      { bootstrapScript },
    );

    const chunks = await collect(stream);
    await allReady;

    const lastChunk = chunks[chunks.length - 1]!;
    expect(lastChunk).toContain(bootstrapScript);
  });

  it('no boundaries — single chunk with shell + bootstrap', async () => {
    const bootstrapScript = '<script>window.__boot=1</script>';

    const { stream, allReady } = renderToStream(
      () => '<p>Static</p>',
      { bootstrapScript },
    );

    const chunks = await collect(stream);
    await allReady;

    // Shell chunk and bootstrap should be the only chunks (2 total since bootstrap is separate enqueue)
    const combined = chunks.join('');
    expect(combined).toContain('<p>Static</p>');
    expect(combined).toContain(bootstrapScript);
    expect(combined).toContain('dr-shell');
  });

  it('onChunk callback is called for each async boundary', async () => {
    const received: { id: string; html: string }[] = [];

    const { stream, allReady } = renderToStream(
      () => {
        suspend(Promise.resolve('<p>Chunk A</p>'), '<p>Loading A</p>');
        return '<div>shell</div>';
      },
      {
        onChunk(chunk) {
          received.push({ id: chunk.id, html: chunk.html });
        },
      },
    );

    await collect(stream);
    await allReady;

    expect(received).toHaveLength(1);
    expect(received[0]!.html).toContain('Chunk A');
  });
});
