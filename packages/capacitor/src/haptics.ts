// Minimal Capacitor Haptics API shape
export interface CapacitorHaptics {
  impact(opts?: { style?: 'heavy' | 'medium' | 'light' }): Promise<void>;
  notification(opts?: { type?: 'success' | 'warning' | 'error' }): Promise<void>;
  vibrate(opts?: { duration?: number }): Promise<void>;
  selectionStart(): Promise<void>;
  selectionChanged(): Promise<void>;
  selectionEnd(): Promise<void>;
}

export interface HapticsHandle {
  impact(style?: 'heavy' | 'medium' | 'light'): Promise<void>;
  success(): Promise<void>;
  warning(): Promise<void>;
  error(): Promise<void>;
  selection(): { start(): Promise<void>; changed(): Promise<void>; end(): Promise<void> };
}

export function createHaptics(haptics: CapacitorHaptics): HapticsHandle {
  return {
    async impact(style: 'heavy' | 'medium' | 'light' = 'medium') {
      await haptics.impact({ style });
    },
    async success() { await haptics.notification({ type: 'success' }); },
    async warning() { await haptics.notification({ type: 'warning' }); },
    async error()   { await haptics.notification({ type: 'error' }); },
    selection() {
      return {
        start:   () => haptics.selectionStart(),
        changed: () => haptics.selectionChanged(),
        end:     () => haptics.selectionEnd(),
      };
    },
  };
}
