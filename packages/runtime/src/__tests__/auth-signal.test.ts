// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthSignal } from '../auth-signal.js';

const mockSession = {
  user: { id: '1', email: 'alice@example.com', name: 'Alice', roles: ['admin', 'user'] },
  token: 'tok_123',
  expiresAt: Date.now() + 60_000,
};

describe('createAuthSignal', () => {
  it('starts unauthenticated', () => {
    const auth = createAuthSignal();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.user()).toBeNull();
    expect(auth.token()).toBeNull();
  });

  it('login() sets user and token', () => {
    const auth = createAuthSignal();
    auth.login(mockSession);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.user()?.name).toBe('Alice');
    expect(auth.token()).toBe('tok_123');
  });

  it('logout() clears session', () => {
    const auth = createAuthSignal();
    auth.login(mockSession);
    auth.logout();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.user()).toBeNull();
  });

  it('hasRole() returns true for granted role', () => {
    const auth = createAuthSignal();
    auth.login(mockSession);
    expect(auth.hasRole('admin')).toBe(true);
    expect(auth.hasRole('superuser')).toBe(false);
  });

  it('isExpired() is false for future expiry', () => {
    const auth = createAuthSignal();
    auth.login({ ...mockSession, expiresAt: Date.now() + 60_000 });
    expect(auth.isExpired()).toBe(false);
  });

  it('isExpired() is true for past expiry', () => {
    const auth = createAuthSignal();
    auth.login({ ...mockSession, expiresAt: Date.now() - 1000 });
    expect(auth.isExpired()).toBe(true);
  });

  it('updateUser() patches user fields', () => {
    const auth = createAuthSignal();
    auth.login(mockSession);
    auth.updateUser({ name: 'Alice Smith' });
    expect(auth.user()?.name).toBe('Alice Smith');
    expect(auth.user()?.email).toBe('alice@example.com');
  });

  it('parseJWT() decodes payload', () => {
    const auth = createAuthSignal();
    // A real JWT with payload { sub: "123", email: "test@example.com", exp: 9999999999 }
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJleHAiOjk5OTk5OTk5OTl9.signature';
    const payload = auth.parseJWT(jwt);
    expect(payload?.sub).toBe('123');
    expect(payload?.email).toBe('test@example.com');
  });

  it('loginWithJWT() logs in from JWT payload', () => {
    const auth = createAuthSignal();
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJleHAiOjk5OTk5OTk5OTl9.signature';
    auth.loginWithJWT(jwt);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.user()?.id).toBe('123');
    expect(auth.user()?.email).toBe('test@example.com');
  });

  it('expiresIn() returns null when not authenticated', () => {
    const auth = createAuthSignal();
    expect(auth.expiresIn()).toBeNull();
  });

  it('storage: memory (default) does not throw', () => {
    expect(() => createAuthSignal({ storage: 'memory' })).not.toThrow();
  });
});
