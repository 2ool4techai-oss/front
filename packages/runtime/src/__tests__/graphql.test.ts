import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGraphQLQuery } from '../graphql.js';

const ENDPOINT = 'https://api.example.com/graphql';
const QUERY = '{ users { id } }';

function mockFetch(response: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(response),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createGraphQLQuery', () => {
  it('fetches immediately when enabled', async () => {
    mockFetch({ data: { users: [] } });
    const h = createGraphQLQuery(ENDPOINT, QUERY);
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
    h.destroy();
  });

  it('data signal is populated after fetch', async () => {
    mockFetch({ data: { users: [{ id: 1 }] } });
    const h = createGraphQLQuery<{ users: { id: number }[] }>(ENDPOINT, QUERY);
    await vi.runAllTimersAsync();
    expect(h.data.peek()).toEqual({ users: [{ id: 1 }] });
    h.destroy();
  });

  it('status goes to error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const h = createGraphQLQuery(ENDPOINT, QUERY);
    await vi.runAllTimersAsync();
    expect(h.status.peek()).toBe('error');
    expect(h.error.peek()).toBeInstanceOf(Error);
    h.destroy();
  });

  it('status goes to error on GraphQL errors array', async () => {
    mockFetch({ errors: [{ message: 'Not found' }] });
    const h = createGraphQLQuery(ENDPOINT, QUERY);
    await vi.runAllTimersAsync();
    expect(h.status.peek()).toBe('error');
    h.destroy();
  });

  it('setVariables triggers refetch', async () => {
    mockFetch({ data: { users: [] } });
    const h = createGraphQLQuery(ENDPOINT, QUERY);
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
    h.setVariables({ id: 2 });
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(2);
    h.destroy();
  });

  it('enabled:false skips initial fetch', async () => {
    mockFetch({ data: {} });
    const h = createGraphQLQuery(ENDPOINT, QUERY, { enabled: false });
    await vi.runAllTimersAsync();
    expect(fetch).not.toHaveBeenCalled();
    h.destroy();
  });

  it('destroy() does not throw', () => {
    mockFetch({ data: {} });
    const h = createGraphQLQuery(ENDPOINT, QUERY, { enabled: false });
    expect(() => h.destroy()).not.toThrow();
  });

  it('refetch() re-calls fetch', async () => {
    mockFetch({ data: { users: [] } });
    const h = createGraphQLQuery(ENDPOINT, QUERY);
    await vi.runAllTimersAsync();
    await h.refetch();
    expect(fetch).toHaveBeenCalledTimes(2);
    h.destroy();
  });
});
