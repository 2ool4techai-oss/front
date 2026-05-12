// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  batterySignal,
  networkSignal,
  geolocationSignal,
  orientationSignal,
  prefersDarkSignal,
  viewportSignal,
  clipboardSignal,
  wakeLockSignal,
  prefersReducedMotionSignal,
} from '../device-signals.js';

// ── batterySignal ──────────────────────────────────────────────────────

describe('batterySignal', () => {
  let mockBattery: {
    level: number;
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    _listeners: Map<string, Array<() => void>>;
    addEventListener: ReturnType<typeof vi.fn>;
    dispatchEvent: (type: string) => void;
  };

  beforeEach(() => {
    mockBattery = {
      level: 0.8,
      charging: true,
      chargingTime: 3600,
      dischargingTime: Infinity,
      _listeners: new Map(),
      addEventListener: vi.fn((type: string, fn: () => void) => {
        if (!mockBattery._listeners.has(type)) mockBattery._listeners.set(type, []);
        mockBattery._listeners.get(type)!.push(fn);
      }),
      dispatchEvent(type: string) {
        for (const fn of mockBattery._listeners.get(type) ?? []) fn();
      },
    };

    vi.stubGlobal('navigator', {
      ...navigator,
      getBattery: vi.fn(() => Promise.resolve(mockBattery)),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null initially before promise resolves', () => {
    const sig = batterySignal();
    expect(sig()).toBeNull();
  });

  it('updates to battery info after getBattery resolves', async () => {
    const sig = batterySignal();
    // Flush the microtask queue fully — getBattery() resolves, then .then() runs
    await new Promise(r => setTimeout(r, 0));

    const info = sig();
    expect(info).not.toBeNull();
    expect(info!.level).toBe(0.8);
    expect(info!.charging).toBe(true);
    expect(info!.chargingTime).toBe(3600);
    expect(info!.dischargingTime).toBe(Infinity);
  });

  it('updates signal on levelchange event', async () => {
    const sig = batterySignal();
    await new Promise(r => setTimeout(r, 0));

    mockBattery.level = 0.5;
    mockBattery.dispatchEvent('levelchange');

    expect(sig()!.level).toBe(0.5);
  });

  it('updates signal on chargingchange event', async () => {
    const sig = batterySignal();
    await new Promise(r => setTimeout(r, 0));

    mockBattery.charging = false;
    mockBattery.dispatchEvent('chargingchange');

    expect(sig()!.charging).toBe(false);
  });

  it('returns null if getBattery not available', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const sig = batterySignal();
    expect(sig()).toBeNull();
  });
});

// ── networkSignal ──────────────────────────────────────────────────────

describe('networkSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads navigator.onLine for initial online state', () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: undefined,
    });
    const sig = networkSignal();
    expect(sig().online).toBe(true);
  });

  it('reflects offline state', () => {
    vi.stubGlobal('navigator', {
      onLine: false,
      connection: undefined,
    });
    const sig = networkSignal();
    expect(sig().online).toBe(false);
  });

  it('updates to offline when offline event fires', () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: undefined,
    });
    const sig = networkSignal();
    expect(sig().online).toBe(true);

    // Simulate going offline
    vi.stubGlobal('navigator', {
      onLine: false,
      connection: undefined,
    });
    window.dispatchEvent(new Event('offline'));
    expect(sig().online).toBe(false);
  });

  it('updates to online when online event fires', () => {
    vi.stubGlobal('navigator', {
      onLine: false,
      connection: undefined,
    });
    const sig = networkSignal();
    expect(sig().online).toBe(false);

    vi.stubGlobal('navigator', {
      onLine: true,
      connection: undefined,
    });
    window.dispatchEvent(new Event('online'));
    expect(sig().online).toBe(true);
  });

  it('reads connection info when available', () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
        addEventListener: vi.fn(),
      },
    });
    const sig = networkSignal();
    const info = sig();
    expect(info.type).toBe('4g');
    expect(info.downlink).toBe(10);
    expect(info.rtt).toBe(50);
    expect(info.saveData).toBe(false);
  });

  it('falls back gracefully when connection API is missing', () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: undefined,
    });
    const sig = networkSignal();
    const info = sig();
    expect(info.type).toBe('unknown');
    expect(info.downlink).toBe(0);
    expect(info.rtt).toBe(0);
    expect(info.saveData).toBe(false);
  });
});

// ── geolocationSignal ──────────────────────────────────────────────────

describe('geolocationSignal', () => {
  let watchPositionCallback: (pos: GeolocationPosition) => void;
  let watchPositionError: (err: GeolocationPositionError) => void;
  let clearWatchMock: ReturnType<typeof vi.fn>;
  let watchPositionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearWatchMock = vi.fn();
    watchPositionMock = vi.fn((success, error) => {
      watchPositionCallback = success;
      watchPositionError = error;
      return 42; // watch ID
    });

    vi.stubGlobal('navigator', {
      onLine: true,
      geolocation: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null position initially', () => {
    const handle = geolocationSignal();
    expect(handle.position()).toBeNull();
    expect(handle.error()).toBeNull();
  });

  it('sets watching to true when geolocation available', () => {
    const handle = geolocationSignal();
    expect(handle.watching()).toBe(true);
  });

  it('updates position signal on watchPosition success', () => {
    const handle = geolocationSignal();

    watchPositionCallback({
      coords: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        altitude: 50,
        speed: 0,
        heading: null,
        altitudeAccuracy: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);

    const pos = handle.position();
    expect(pos).not.toBeNull();
    expect(pos!.lat).toBe(37.7749);
    expect(pos!.lng).toBe(-122.4194);
    expect(pos!.accuracy).toBe(10);
    expect(pos!.altitude).toBe(50);
  });

  it('updates error signal on watchPosition failure', () => {
    const handle = geolocationSignal();
    const mockError = { code: 1, message: 'Permission denied' } as GeolocationPositionError;

    watchPositionError(mockError);

    expect(handle.error()).toBe(mockError);
  });

  it('stop() calls clearWatch and sets watching to false', () => {
    const handle = geolocationSignal();
    expect(handle.watching()).toBe(true);

    handle.stop();

    expect(clearWatchMock).toHaveBeenCalledWith(42);
    expect(handle.watching()).toBe(false);
  });

  it('returns null position if geolocation not available', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const handle = geolocationSignal();
    expect(handle.position()).toBeNull();
    expect(handle.watching()).toBe(false);
  });
});

// ── orientationSignal ──────────────────────────────────────────────────

describe('orientationSignal', () => {
  it('returns null initially', () => {
    const sig = orientationSignal();
    expect(sig()).toBeNull();
  });

  it('updates on deviceorientation event', () => {
    const sig = orientationSignal();

    const event = new Event('deviceorientation') as DeviceOrientationEvent;
    Object.defineProperty(event, 'alpha', { value: 90 });
    Object.defineProperty(event, 'beta', { value: 45 });
    Object.defineProperty(event, 'gamma', { value: -30 });
    Object.defineProperty(event, 'absolute', { value: true });

    window.dispatchEvent(event);

    const info = sig();
    expect(info).not.toBeNull();
    expect(info!.alpha).toBe(90);
    expect(info!.beta).toBe(45);
    expect(info!.gamma).toBe(-30);
    expect(info!.absolute).toBe(true);
  });

  it('updates multiple times on repeated events', () => {
    const sig = orientationSignal();

    const e1 = new Event('deviceorientation') as DeviceOrientationEvent;
    Object.defineProperty(e1, 'alpha', { value: 0 });
    Object.defineProperty(e1, 'beta', { value: 0 });
    Object.defineProperty(e1, 'gamma', { value: 0 });
    Object.defineProperty(e1, 'absolute', { value: false });
    window.dispatchEvent(e1);

    expect(sig()!.alpha).toBe(0);

    const e2 = new Event('deviceorientation') as DeviceOrientationEvent;
    Object.defineProperty(e2, 'alpha', { value: 180 });
    Object.defineProperty(e2, 'beta', { value: 10 });
    Object.defineProperty(e2, 'gamma', { value: 20 });
    Object.defineProperty(e2, 'absolute', { value: true });
    window.dispatchEvent(e2);

    expect(sig()!.alpha).toBe(180);
    expect(sig()!.beta).toBe(10);
  });
});

// ── prefersDarkSignal ──────────────────────────────────────────────────

describe('prefersDarkSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns initial dark mode preference (false)', () => {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    vi.stubGlobal('window', {
      ...window,
      matchMedia: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn((type: string, fn: (e: MediaQueryListEvent) => void) => {
          listeners.push(fn);
        }),
      })),
    });

    const sig = prefersDarkSignal();
    expect(sig()).toBe(false);
  });

  it('returns true when dark mode is preferred', () => {
    vi.stubGlobal('window', {
      ...window,
      matchMedia: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
      })),
    });

    const sig = prefersDarkSignal();
    expect(sig()).toBe(true);
  });

  it('updates when OS theme changes', () => {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    vi.stubGlobal('window', {
      ...window,
      matchMedia: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn((type: string, fn: (e: MediaQueryListEvent) => void) => {
          listeners.push(fn);
        }),
      })),
    });

    const sig = prefersDarkSignal();
    expect(sig()).toBe(false);

    // Simulate OS switching to dark mode
    listeners.forEach(fn => fn({ matches: true } as MediaQueryListEvent));
    expect(sig()).toBe(true);
  });
});

// ── viewportSignal ─────────────────────────────────────────────────────

describe('viewportSignal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reads initial viewport dimensions', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1023, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });

    const sig = viewportSignal();
    expect(sig().width).toBe(1023);
    expect(sig().height).toBe(768);
  });

  it('returns correct breakpoint for xs', () => {
    Object.defineProperty(window, 'innerWidth', { value: 320, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 568, writable: true, configurable: true });

    const sig = viewportSignal();
    expect(sig().breakpoint).toBe('xs');
  });

  it('returns correct breakpoint for sm', () => {
    Object.defineProperty(window, 'innerWidth', { value: 700, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, writable: true, configurable: true });

    const sig = viewportSignal();
    expect(sig().breakpoint).toBe('sm');
  });

  it('returns correct breakpoint for md', () => {
    Object.defineProperty(window, 'innerWidth', { value: 900, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true, configurable: true });

    const sig = viewportSignal();
    expect(sig().breakpoint).toBe('md');
  });

  it('returns correct breakpoint for lg', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });

    const sig = viewportSignal();
    expect(sig().breakpoint).toBe('lg');
  });

  it('returns correct breakpoint for xl', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, writable: true, configurable: true });

    const sig = viewportSignal();
    expect(sig().breakpoint).toBe('xl');
  });

  it('returns correct breakpoint for 2xl', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1600, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, writable: true, configurable: true });

    const sig = viewportSignal();
    expect(sig().breakpoint).toBe('2xl');
  });

  it('updates breakpoint after resize (debounced 100ms)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 900, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });

    const sig = viewportSignal();
    expect(sig().breakpoint).toBe('md');

    // Change the viewport size and dispatch resize
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
    window.dispatchEvent(new Event('resize'));

    // Before debounce fires, value should not have changed
    expect(sig().breakpoint).toBe('md');

    // After debounce
    vi.advanceTimersByTime(100);
    expect(sig().breakpoint).toBe('xs');
  });

  it('debounces multiple resize events', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });

    const sig = viewportSignal();

    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(50);

    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(50);

    // Only 50ms have passed since last resize — no update yet
    expect(sig().width).toBe(1024);

    vi.advanceTimersByTime(50);
    // Now 100ms have passed since last resize
    expect(sig().width).toBe(400);
  });
});

// ── clipboardSignal ────────────────────────────────────────────────────

describe('clipboardSignal', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        readText: vi.fn(() => Promise.resolve('hello clipboard')),
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lastRead starts as null', () => {
    const handle = clipboardSignal();
    expect(handle.lastRead()).toBeNull();
  });

  it('read() returns text and updates lastRead', async () => {
    const handle = clipboardSignal();
    const text = await handle.read();
    expect(text).toBe('hello clipboard');
    expect(handle.lastRead()).toBe('hello clipboard');
  });

  it('write() calls clipboard.writeText', async () => {
    const handle = clipboardSignal();
    await handle.write('test text');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
  });
});

// ── wakeLockSignal ─────────────────────────────────────────────────────

describe('wakeLockSignal', () => {
  let releaseMock: ReturnType<typeof vi.fn>;
  let sentinelListeners: Map<string, Array<() => void>>;

  beforeEach(() => {
    sentinelListeners = new Map();
    releaseMock = vi.fn(async () => {
      for (const fn of sentinelListeners.get('release') ?? []) fn();
    });

    const mockSentinel = {
      released: false,
      release: releaseMock,
      addEventListener: vi.fn((type: string, fn: () => void) => {
        if (!sentinelListeners.has(type)) sentinelListeners.set(type, []);
        sentinelListeners.get(type)!.push(fn);
      }),
    };

    vi.stubGlobal('navigator', {
      ...navigator,
      wakeLock: {
        request: vi.fn(() => Promise.resolve(mockSentinel)),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('active starts as false', () => {
    const handle = wakeLockSignal();
    expect(handle.active()).toBe(false);
  });

  it('active becomes true after request()', async () => {
    const handle = wakeLockSignal();
    await handle.request();
    expect(handle.active()).toBe(true);
  });

  it('active becomes false after release()', async () => {
    const handle = wakeLockSignal();
    await handle.request();
    expect(handle.active()).toBe(true);
    await handle.release();
    expect(handle.active()).toBe(false);
  });

  it('graceful fallback if wakeLock API not available', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const handle = wakeLockSignal();
    await handle.request(); // should not throw
    expect(handle.active()).toBe(false);
  });
});

// ── prefersReducedMotionSignal ─────────────────────────────────────────

describe('prefersReducedMotionSignal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when reduced motion not preferred', () => {
    vi.stubGlobal('window', {
      ...window,
      matchMedia: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
      })),
    });

    const sig = prefersReducedMotionSignal();
    expect(sig()).toBe(false);
  });

  it('returns true when reduced motion is preferred', () => {
    vi.stubGlobal('window', {
      ...window,
      matchMedia: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
      })),
    });

    const sig = prefersReducedMotionSignal();
    expect(sig()).toBe(true);
  });
});
