import { signal, computed } from './signal.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  roles: string[];
  metadata?: Record<string, unknown>;
}

export interface Session {
  user: User | null;
  token: string | null;
  expiresAt: number | null; // Unix timestamp ms
  refreshToken?: string | null;
}

export interface AuthSignalOptions {
  storage?: 'localStorage' | 'sessionStorage' | 'memory' | 'cookie'; // Default: 'memory'
  storageKey?: string;    // Default: 'dr_session'
  autoRefresh?: boolean;  // Auto-call refreshFn before expiry. Default: true
  refreshBuffer?: number; // ms before expiry to refresh. Default: 60_000 (1 min)
  refreshFn?: (refreshToken: string) => Promise<Session>;
  onExpired?: () => void;
  onRefreshError?: (err: unknown) => void;
}

export interface AuthHandle {
  // Reactive signals
  user: () => User | null;
  token: () => string | null;
  isAuthenticated: () => boolean;
  isExpired: () => boolean;
  expiresIn: () => number | null;
  hasRole: (role: string) => boolean;

  // Imperative actions
  login: (session: Session) => void;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  setToken: (token: string, expiresAt?: number) => void;

  // JWT helpers
  parseJWT: (token: string) => Record<string, unknown> | null;
  loginWithJWT: (jwt: string, userPatch?: Partial<User>) => void;
}

// ── Base64url decode (no external deps) ───────────────────────────────

function base64urlDecode(str: string): string {
  // Replace URL-safe chars with standard base64 chars
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad to multiple of 4
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  // Decode
  try {
    return atob(base64);
  } catch {
    return '';
  }
}

// ── Storage helpers ────────────────────────────────────────────────────

function getStorage(type: AuthSignalOptions['storage']): Storage | null {
  if (type === 'localStorage') {
    try { return localStorage; } catch { return null; }
  }
  if (type === 'sessionStorage') {
    try { return sessionStorage; } catch { return null; }
  }
  return null;
}

function readFromStorage(storage: Storage | null, key: string): Session | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function writeToStorage(storage: Storage | null, key: string, session: Session): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(session));
  } catch {
    // Storage might be full or unavailable
  }
}

function removeFromStorage(storage: Storage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore
  }
}

// ── createAuthSignal ───────────────────────────────────────────────────

const EMPTY_SESSION: Session = { user: null, token: null, expiresAt: null, refreshToken: null };

export function createAuthSignal(opts?: AuthSignalOptions): AuthHandle {
  const storageType = opts?.storage ?? 'memory';
  const storageKey = opts?.storageKey ?? 'dr_session';
  const autoRefresh = opts?.autoRefresh ?? true;
  const refreshBuffer = opts?.refreshBuffer ?? 60_000;

  const store = getStorage(storageType);

  // Restore from storage on init
  const initialSession = readFromStorage(store, storageKey) ?? { ...EMPTY_SESSION };

  const _session = signal<Session>(initialSession);

  // Derived computeds
  const user = computed<User | null>(() => _session().user);
  const token = computed<string | null>(() => _session().token);
  const isAuthenticated = computed<boolean>(() => user() !== null && token() !== null);
  const isExpired = computed<boolean>(() => {
    const ea = _session().expiresAt;
    return ea !== null && Date.now() > ea;
  });

  // expiresIn: updated by setInterval every second
  const _expiresIn = signal<number | null>(null);

  function updateExpiresIn(): void {
    const ea = _session.peek().expiresAt;
    _expiresIn.set(ea !== null ? ea - Date.now() : null);
  }

  updateExpiresIn();
  const intervalId = setInterval(updateExpiresIn, 1000);

  // Auto-refresh scheduling
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  function scheduleRefresh(session: Session): void {
    if (refreshTimeout !== null) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    if (!autoRefresh || !opts?.refreshFn || !session.refreshToken || session.expiresAt === null) {
      return;
    }
    const delay = session.expiresAt - Date.now() - refreshBuffer;
    if (delay <= 0) return;

    refreshTimeout = setTimeout(async () => {
      const currentSession = _session.peek();
      if (!currentSession.refreshToken) return;
      try {
        const newSession = await opts.refreshFn!(currentSession.refreshToken);
        applyLogin(newSession);
      } catch (err) {
        opts.onRefreshError?.(err);
        opts.onExpired?.();
      }
    }, delay);
  }

  function applyLogin(session: Session): void {
    _session.set(session);
    writeToStorage(store, storageKey, session);
    updateExpiresIn();
    scheduleRefresh(session);
  }

  // If we restored a session, schedule refresh for it
  if (initialSession.user !== null) {
    scheduleRefresh(initialSession);
  }

  return {
    user: () => user(),
    token: () => token(),
    isAuthenticated: () => isAuthenticated(),
    isExpired: () => isExpired(),
    expiresIn: () => _expiresIn(),
    hasRole: (role: string): boolean => {
      const u = user();
      return u !== null && u.roles.includes(role);
    },

    login(session: Session): void {
      applyLogin(session);
    },

    logout(): void {
      if (refreshTimeout !== null) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
      _session.set({ ...EMPTY_SESSION });
      removeFromStorage(store, storageKey);
      _expiresIn.set(null);
    },

    updateUser(patch: Partial<User>): void {
      const current = _session.peek();
      if (!current.user) return;
      const updated: Session = {
        ...current,
        user: { ...current.user, ...patch },
      };
      _session.set(updated);
      writeToStorage(store, storageKey, updated);
    },

    setToken(token: string, expiresAt?: number): void {
      const current = _session.peek();
      const updated: Session = {
        ...current,
        token,
        expiresAt: expiresAt ?? current.expiresAt,
      };
      _session.set(updated);
      writeToStorage(store, storageKey, updated);
      updateExpiresIn();
      scheduleRefresh(updated);
    },

    parseJWT(jwt: string): Record<string, unknown> | null {
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      try {
        const decoded = base64urlDecode(parts[1] ?? '');
        return JSON.parse(decoded) as Record<string, unknown>;
      } catch {
        return null;
      }
    },

    loginWithJWT(jwt: string, userPatch?: Partial<User>): void {
      const payload = this.parseJWT(jwt);
      if (!payload) return;

      const id = typeof payload.sub === 'string' ? payload.sub : String(payload.sub ?? '');
      const email = typeof payload.email === 'string' ? payload.email : undefined;
      const name = typeof payload.name === 'string' ? payload.name : undefined;
      const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : null;

      const user = {
        id,
        email,
        name,
        roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
        ...userPatch,
      } as User;

      const session: Session = {
        user,
        token: jwt,
        expiresAt: exp,
        refreshToken: null,
      };

      applyLogin(session);
    },
  };
}
