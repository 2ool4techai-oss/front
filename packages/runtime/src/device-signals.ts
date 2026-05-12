import { signal } from './signal.js';

// ── BatterySignal ──────────────────────────────────────────────────────

export interface BatteryInfo {
  level: number;           // 0-1
  charging: boolean;
  chargingTime: number;    // seconds
  dischargingTime: number; // seconds
}

export function batterySignal(): () => BatteryInfo | null {
  const sig = signal<BatteryInfo | null>(null);

  if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    (navigator as Navigator & { getBattery(): Promise<BatteryManager> })
      .getBattery()
      .then((battery: BatteryManager) => {
        const update = () => {
          sig.set({
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
          });
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
        battery.addEventListener('chargingtimechange', update);
        battery.addEventListener('dischargingtimechange', update);
      })
      .catch(() => {
        // API not available or permission denied
      });
  }

  return sig;
}

// Battery Manager interface (not in all TS libs)
interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

// ── NetworkSignal ──────────────────────────────────────────────────────

export interface NetworkInfo {
  online: boolean;
  type: string;       // 'wifi' | '4g' | '3g' | 'slow-2g' | 'unknown'
  downlink: number;   // Mbps
  rtt: number;        // ms round-trip time
  saveData: boolean;
}

interface NetworkInformation extends EventTarget {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

function getNetworkInfo(): NetworkInfo {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const conn = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { connection?: NetworkInformation }).connection
    : undefined;

  return {
    online,
    type: conn?.effectiveType ?? conn?.type ?? 'unknown',
    downlink: conn?.downlink ?? 0,
    rtt: conn?.rtt ?? 0,
    saveData: conn?.saveData ?? false,
  };
}

export function networkSignal(): () => NetworkInfo {
  const sig = signal<NetworkInfo>(getNetworkInfo());

  if (typeof window !== 'undefined') {
    const update = () => sig.set(getNetworkInfo());

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (conn) {
      conn.addEventListener('change', update);
    }
  }

  return sig;
}

// ── GeolocationSignal ──────────────────────────────────────────────────

export interface GeoInfo {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
}

export interface GeoSignalHandle {
  position: () => GeoInfo | null;
  error: () => GeolocationPositionError | null;
  watching: () => boolean;
  stop: () => void;
}

export function geolocationSignal(opts?: PositionOptions): GeoSignalHandle {
  const position = signal<GeoInfo | null>(null);
  const error = signal<GeolocationPositionError | null>(null);
  const watching = signal<boolean>(false);

  let watchId: number | null = null;

  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    watching.set(true);
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        error.set(null);
        position.set({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        });
      },
      (err) => {
        error.set(err);
      },
      opts,
    );
  }

  const stop = () => {
    if (watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    watching.set(false);
  };

  return { position, error, watching, stop };
}

// ── OrientationSignal ──────────────────────────────────────────────────

export interface OrientationInfo {
  alpha: number | null; // Z rotation (compass)
  beta: number | null;  // X tilt
  gamma: number | null; // Y tilt
  absolute: boolean;
}

export function orientationSignal(): () => OrientationInfo | null {
  const sig = signal<OrientationInfo | null>(null);

  if (typeof window !== 'undefined') {
    window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
      sig.set({
        alpha: e.alpha,
        beta: e.beta,
        gamma: e.gamma,
        absolute: e.absolute,
      });
    });
  }

  return sig;
}

// ── ClipboardSignal ────────────────────────────────────────────────────

export interface ClipboardHandle {
  read: () => Promise<string>;
  write: (text: string) => Promise<void>;
  lastRead: () => string | null; // reactive
}

export function clipboardSignal(): ClipboardHandle {
  const lastRead = signal<string | null>(null);

  const read = async (): Promise<string> => {
    const text = await navigator.clipboard.readText();
    lastRead.set(text);
    return text;
  };

  const write = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
  };

  return { read, write, lastRead };
}

// ── WakeLockSignal ─────────────────────────────────────────────────────

export interface WakeLockHandle {
  active: () => boolean; // reactive signal
  request: () => Promise<void>;
  release: () => Promise<void>;
}

interface WakeLockSentinel extends EventTarget {
  released: boolean;
  release(): Promise<void>;
}

export function wakeLockSignal(): WakeLockHandle {
  const active = signal<boolean>(false);
  let sentinel: WakeLockSentinel | null = null;

  const request = async (): Promise<void> => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      sentinel = await (
        navigator as Navigator & { wakeLock: { request(type: string): Promise<WakeLockSentinel> } }
      ).wakeLock.request('screen');
      active.set(true);
      sentinel.addEventListener('release', () => {
        active.set(false);
        sentinel = null;
      });
    } catch {
      // Permission denied or not supported
    }
  };

  const release = async (): Promise<void> => {
    if (sentinel) {
      await sentinel.release();
      sentinel = null;
      active.set(false);
    }
  };

  return { active, request, release };
}

// ── PrefersDarkSignal ──────────────────────────────────────────────────

export function prefersDarkSignal(): () => boolean {
  const query =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  const sig = signal<boolean>(query?.matches ?? false);

  if (query) {
    query.addEventListener('change', (e: MediaQueryListEvent) => {
      sig.set(e.matches);
    });
  }

  return sig;
}

// ── PrefersReducedMotionSignal ─────────────────────────────────────────

export function prefersReducedMotionSignal(): () => boolean {
  const query =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const sig = signal<boolean>(query?.matches ?? false);

  if (query) {
    query.addEventListener('change', (e: MediaQueryListEvent) => {
      sig.set(e.matches);
    });
  }

  return sig;
}

// ── ViewportSignal ─────────────────────────────────────────────────────

export interface ViewportInfo {
  width: number;
  height: number;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

function getBreakpoint(width: number): ViewportInfo['breakpoint'] {
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
}

function getViewportInfo(): ViewportInfo {
  const width = typeof window !== 'undefined' ? window.innerWidth : 0;
  const height = typeof window !== 'undefined' ? window.innerHeight : 0;
  return { width, height, breakpoint: getBreakpoint(width) };
}

export function viewportSignal(): () => ViewportInfo {
  const sig = signal<ViewportInfo>(getViewportInfo());

  if (typeof window !== 'undefined') {
    let timer: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener('resize', () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        sig.set(getViewportInfo());
        timer = null;
      }, 100);
    });
  }

  return sig;
}
