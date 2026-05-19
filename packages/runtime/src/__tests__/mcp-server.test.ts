import { describe, it, expect } from 'vitest';
import { createMCPServer } from '../mcp-server.js';
import { signal } from '../signal.js';

describe('createMCPServer', () => {
  it('initialize returns server info', async () => {
    const mcp = createMCPServer({ name: 'test-server' });
    const res = await mcp.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {} } });
    expect(res.result).toMatchObject({ serverInfo: { name: 'test-server' } });
  });

  it('tools/list returns exposed signals', async () => {
    const mcp = createMCPServer();
    const count = signal(0);
    mcp.expose('counter', count as any, { description: 'A counter' });
    const res = await mcp.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = (res.result as { tools: { name: string }[] }).tools;
    expect(tools.some(t => t.name === 'signal_read__counter')).toBe(true);
    expect(tools.some(t => t.name === 'signal_write__counter')).toBe(true);
  });

  it('tools/call reads a signal', async () => {
    const mcp = createMCPServer();
    const count = signal(42);
    mcp.expose('counter', count as any);
    const res = await mcp.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'signal_read__counter', arguments: {} } });
    expect((res.result as { content: { text: string }[] }).content[0]!.text).toContain('42');
  });

  it('tools/call writes a signal', async () => {
    const mcp = createMCPServer();
    const count = signal(0);
    mcp.expose('counter', count as any);
    await mcp.handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'signal_write__counter', arguments: { value: 99 } } });
    expect(count()).toBe(99);
  });

  it('readOnly signals do not get write tool', async () => {
    const mcp = createMCPServer();
    const count = signal(0);
    mcp.expose('counter', count as any, { readOnly: true });
    const res = await mcp.handle({ jsonrpc: '2.0', id: 5, method: 'tools/list' });
    const tools = (res.result as { tools: { name: string }[] }).tools;
    expect(tools.some(t => t.name === 'signal_write__counter')).toBe(false);
    expect(tools.some(t => t.name === 'signal_read__counter')).toBe(true);
  });

  it('snapshot() returns all signal values', () => {
    const mcp = createMCPServer();
    const count = signal(7);
    mcp.expose('count', count as any);
    const snap = mcp.snapshot();
    expect(snap['count']).toBe(7);
  });

  it('unknown method returns error', async () => {
    const mcp = createMCPServer();
    const res = await mcp.handle({ jsonrpc: '2.0', id: 6, method: 'unknown/method' });
    expect(res.error?.code).toBe(-32601);
  });

  it('resources/list returns signal URIs', async () => {
    const mcp = createMCPServer();
    const count = signal(0);
    mcp.expose('counter', count as any);
    const res = await mcp.handle({ jsonrpc: '2.0', id: 7, method: 'resources/list' });
    const resources = (res.result as { resources: { uri: string }[] }).resources;
    expect(resources.some(r => r.uri === 'signal://counter')).toBe(true);
  });
});
