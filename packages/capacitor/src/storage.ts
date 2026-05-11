// Mock Capacitor Preferences API shape
export interface CapacitorPreferences {
  get(opts: { key: string }): Promise<{ value: string | null }>;
  set(opts: { key: string; value: string }): Promise<void>;
  remove(opts: { key: string }): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
}

export interface CapacitorStorageOptions<T> {
  key:          string;
  defaultValue: T;
  serialize?:   (v: T) => string;
  parse?:       (raw: string) => T;
}

export interface CapacitorStorageHandle<T> {
  value:   T;
  loading: boolean;
  error:   Error | null;
  set(v: T): Promise<void>;
  reload(): Promise<void>;
  remove(): Promise<void>;
}

export function createCapacitorStorage<T>(
  preferences: CapacitorPreferences,
  opts: CapacitorStorageOptions<T>,
): CapacitorStorageHandle<T> {
  const serialize = opts.serialize ?? JSON.stringify;
  const parse     = opts.parse     ?? ((s: string) => JSON.parse(s) as T);

  const state = {
    value:   opts.defaultValue,
    loading: true,
    error:   null as Error | null,
  };

  // Kick off initial load
  void preferences.get({ key: opts.key }).then(result => {
    state.loading = false;
    if (result.value !== null) {
      try { state.value = parse(result.value); } catch { state.value = opts.defaultValue; }
    }
  }).catch(err => {
    state.loading = false;
    state.error = err instanceof Error ? err : new Error(String(err));
  });

  return {
    get value() { return state.value; },
    get loading() { return state.loading; },
    get error() { return state.error; },
    async set(v: T): Promise<void> {
      try {
        await preferences.set({ key: opts.key, value: serialize(v) });
        state.value = v;
      } catch (err) {
        state.error = err instanceof Error ? err : new Error(String(err));
      }
    },
    async reload(): Promise<void> {
      state.loading = true;
      try {
        const result = await preferences.get({ key: opts.key });
        if (result.value !== null) {
          state.value = parse(result.value);
        }
      } catch (err) {
        state.error = err instanceof Error ? err : new Error(String(err));
      } finally {
        state.loading = false;
      }
    },
    async remove(): Promise<void> {
      await preferences.remove({ key: opts.key });
      state.value = opts.defaultValue;
    },
  };
}
