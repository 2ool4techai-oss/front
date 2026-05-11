// Sync a signal to electron-store (or any key-value persistence)
export interface StoreAdapter {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface StoreSyncOptions {
  prefix?: string;
  keys?:   string[]; // which signal labels to persist
}

export interface StoreSyncHandle {
  save(label: string, value: unknown): void;
  load(label: string): unknown;
  clear(): void;
}

export function createStoreSync(store: StoreAdapter, opts?: StoreSyncOptions): StoreSyncHandle {
  const prefix = opts?.prefix ?? 'drishti.';
  const keys = opts?.keys;

  return {
    save(label: string, value: unknown): void {
      if (keys && !keys.includes(label)) return;
      try {
        store.set(`${prefix}${label}`, value);
      } catch { /* ignore */ }
    },
    load(label: string): unknown {
      try {
        return store.get(`${prefix}${label}`);
      } catch {
        return undefined;
      }
    },
    clear(): void {
      const labelsToDelete = keys ?? [];
      for (const l of labelsToDelete) {
        try { store.delete(`${prefix}${l}`); } catch { /* ignore */ }
      }
    },
  };
}
