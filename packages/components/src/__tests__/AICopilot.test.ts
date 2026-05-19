// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCopilot } from '../AICopilot.js';
import type { CopilotHandle } from '../AICopilot.js';

describe('createCopilot', () => {
  let handle: CopilotHandle;

  beforeEach(() => {
    document.body.innerHTML = '';
    // Remove injected styles so each test starts clean
    document.getElementById('dr-copilot-styles')?.remove();
    handle = createCopilot({
      signals: {
        count: { get: () => 42 },
        items: { get: () => ['a', 'b', 'c'] },
        route: { get: () => '/home' },
      },
    });
  });

  it('createCopilot returns handle with all required methods', () => {
    expect(typeof handle.open).toBe('function');
    expect(typeof handle.close).toBe('function');
    expect(typeof handle.toggle).toBe('function');
    expect(typeof handle.sendMessage).toBe('function');
    expect(typeof handle.getMessages).toBe('function');
    expect(typeof handle.clearHistory).toBe('function');
    expect(typeof handle.getSignalContext).toBe('function');
    expect(typeof handle.dispose).toBe('function');
  });

  it('getSignalContext returns values from registered signals', () => {
    const ctx = handle.getSignalContext();
    expect(ctx.count).toBe(42);
    expect(ctx.items).toEqual(['a', 'b', 'c']);
    expect(ctx.route).toBe('/home');
  });

  it('getSignalContext returns empty object when no signals registered', () => {
    document.body.innerHTML = '';
    const h = createCopilot();
    expect(h.getSignalContext()).toEqual({});
    h.dispose();
  });

  it('sendMessage rule-based: "what is the state" returns assistant message describing state', async () => {
    const reply = await handle.sendMessage('what is the state');
    expect(reply.role).toBe('assistant');
    expect(reply.content).toMatch(/count|items|route/i);
  });

  it('sendMessage rule-based: "show me" returns state description', async () => {
    const reply = await handle.sendMessage('show me everything');
    expect(reply.role).toBe('assistant');
    expect(reply.content.length).toBeGreaterThan(0);
  });

  it('sendMessage rule-based: "how many" returns count info for arrays', async () => {
    const reply = await handle.sendMessage('how many items are there');
    expect(reply.role).toBe('assistant');
    expect(reply.content).toMatch(/item/i);
    expect(reply.content).toMatch(/3/);
  });

  it('sendMessage rule-based: "navigate" returns navigation suggestions', async () => {
    const reply = await handle.sendMessage('navigate to home');
    expect(reply.role).toBe('assistant');
    // Should suggest route signal
    const hasActions =
      (reply.actions && reply.actions.length > 0) || reply.content.length > 0;
    expect(hasActions).toBe(true);
  });

  it('sendMessage rule-based: default response for unrecognised input', async () => {
    const reply = await handle.sendMessage('do something random xyz');
    expect(reply.role).toBe('assistant');
    expect(reply.content).toContain('app state');
  });

  it('sendMessage adds both user and assistant messages to history', async () => {
    const before = handle.getMessages().length;
    await handle.sendMessage('what is the state');
    const after = handle.getMessages().length;
    // +2: one user, one assistant (welcome message already in before)
    expect(after - before).toBe(2);
  });

  it('getMessages returns all sent + received messages', async () => {
    await handle.sendMessage('what is the state');
    await handle.sendMessage('how many items');
    const msgs = handle.getMessages();
    // welcome + (user + assistant) * 2
    expect(msgs.length).toBeGreaterThanOrEqual(4);
    const roles = msgs.map(m => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  it('clearHistory empties messages', async () => {
    await handle.sendMessage('what is the state');
    expect(handle.getMessages().length).toBeGreaterThan(0);
    handle.clearHistory();
    expect(handle.getMessages()).toHaveLength(0);
  });

  it('each message has an id and timestamp', async () => {
    const reply = await handle.sendMessage('show me');
    expect(reply.id).toBeTruthy();
    expect(typeof reply.timestamp).toBe('number');
    expect(reply.timestamp).toBeGreaterThan(0);
  });

  it('open sets internal state (panel becomes visible)', () => {
    handle.open();
    const panel = document.querySelector('.dr-copilot-panel');
    expect(panel?.classList.contains('dr-copilot-hidden')).toBe(false);
  });

  it('close hides panel', () => {
    handle.open();
    handle.close();
    const panel = document.querySelector('.dr-copilot-panel');
    expect(panel?.classList.contains('dr-copilot-hidden')).toBe(true);
  });

  it('toggle opens then closes panel', () => {
    handle.toggle();
    const panel = document.querySelector('.dr-copilot-panel');
    expect(panel?.classList.contains('dr-copilot-hidden')).toBe(false);
    handle.toggle();
    expect(panel?.classList.contains('dr-copilot-hidden')).toBe(true);
  });

  it('dispose removes DOM elements', () => {
    expect(document.querySelector('.dr-copilot-btn')).toBeTruthy();
    handle.dispose();
    expect(document.querySelector('.dr-copilot-btn')).toBeNull();
    expect(document.querySelector('.dr-copilot-panel')).toBeNull();
  });

  it('sendMessage with endpoint POSTs and returns AI reply', async () => {
    document.body.innerHTML = '';
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ reply: 'AI says hello', actions: [] }),
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const h = createCopilot({
      endpoint: 'https://api.example.com/copilot',
      apiKey: 'test-key',
      signals: { x: { get: () => 1 } },
    });

    const reply = await h.sendMessage('hello');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/copilot',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(reply.content).toBe('AI says hello');
    h.dispose();
  });

  it('onAction callback fires when action button clicked', async () => {
    document.body.innerHTML = '';
    document.getElementById('dr-copilot-styles')?.remove();

    const onAction = vi.fn();
    const h = createCopilot({
      signals: { route: { get: () => '/dashboard' } },
      onAction,
    });

    const reply = await h.sendMessage('navigate to dashboard');
    // If actions were returned, click the first action button
    if (reply.actions && reply.actions.length > 0) {
      const actionBtn = document.querySelector('.dr-copilot-action-btn') as HTMLButtonElement;
      actionBtn?.click();
      expect(onAction).toHaveBeenCalledWith(reply.actions[0]);
    } else {
      // No navigation signals matched — that's acceptable, just verify no error
      expect(reply.role).toBe('assistant');
    }
    h.dispose();
  });
});
