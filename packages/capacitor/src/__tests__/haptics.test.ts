import { describe, it, expect, vi } from 'vitest';
import { createHaptics } from '../haptics.js';
import type { CapacitorHaptics } from '../haptics.js';

function makeHaptics(): CapacitorHaptics & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    impact:           async (o) => { calls.push(`impact:${o?.style ?? 'medium'}`); },
    notification:     async (o) => { calls.push(`notification:${o?.type ?? 'success'}`); },
    vibrate:          async (o) => { calls.push(`vibrate:${o?.duration ?? 300}`); },
    selectionStart:   async () => { calls.push('selectionStart'); },
    selectionChanged: async () => { calls.push('selectionChanged'); },
    selectionEnd:     async () => { calls.push('selectionEnd'); },
  };
}

describe('createHaptics', () => {
  it('impact() calls haptics.impact', async () => {
    const h = makeHaptics();
    const haptics = createHaptics(h);
    await haptics.impact('heavy');
    expect(h.calls).toContain('impact:heavy');
  });

  it('success() calls notification success', async () => {
    const h = makeHaptics();
    await createHaptics(h).success();
    expect(h.calls).toContain('notification:success');
  });

  it('error() calls notification error', async () => {
    const h = makeHaptics();
    await createHaptics(h).error();
    expect(h.calls).toContain('notification:error');
  });

  it('selection.start/changed/end work', async () => {
    const h = makeHaptics();
    const sel = createHaptics(h).selection();
    await sel.start();
    await sel.changed();
    await sel.end();
    expect(h.calls).toContain('selectionStart');
    expect(h.calls).toContain('selectionChanged');
    expect(h.calls).toContain('selectionEnd');
  });
});
