import { describe, it, expect, vi, beforeEach } from 'vitest';
import { anomalySignal } from '../anomaly.js';

describe('anomalySignal', () => {
  it('holds initial value', () => {
    const sig = anomalySignal(10, {});
    expect(sig()).toBe(10);
  });

  it('set() updates value correctly', () => {
    const sig = anomalySignal(0, {});
    sig.set(5);
    expect(sig()).toBe(5);
  });

  it('peek() returns current value', () => {
    const sig = anomalySignal(42, {});
    expect(sig.peek()).toBe(42);
  });

  it('anomalies() starts empty', () => {
    const sig = anomalySignal(100, {});
    expect(sig.anomalies()).toHaveLength(0);
  });

  it('isAnomaly() returns false initially', () => {
    const sig = anomalySignal(100, {});
    expect(sig.isAnomaly()).toBe(false);
  });

  it('clearAnomalies() empties the anomaly list', () => {
    const onAnomaly = vi.fn();
    const sig = anomalySignal(100, {
      builtInRules: { impossibleValue: { min: 0, max: 200 } },
      onAnomaly,
    });
    sig.set(9999); // out of range
    expect(sig.anomalies().length).toBeGreaterThan(0);
    sig.clearAnomalies();
    expect(sig.anomalies()).toHaveLength(0);
    expect(sig.isAnomaly()).toBe(false);
  });

  it('impossibleValue rule detects value above max', () => {
    const onAnomaly = vi.fn();
    const sig = anomalySignal(50, {
      builtInRules: { impossibleValue: { min: 0, max: 100 } },
      onAnomaly,
    });
    sig.set(150);
    expect(onAnomaly).toHaveBeenCalledOnce();
    expect(onAnomaly.mock.calls[0][0].rule).toBe('impossibleValue');
    expect(sig.isAnomaly()).toBe(true);
  });

  it('impossibleValue rule detects value below min', () => {
    const onAnomaly = vi.fn();
    const sig = anomalySignal(50, {
      builtInRules: { impossibleValue: { min: 10, max: 100 } },
      onAnomaly,
    });
    sig.set(5);
    expect(onAnomaly).toHaveBeenCalledOnce();
    expect(onAnomaly.mock.calls[0][0].rule).toBe('impossibleValue');
  });

  it('impossibleValue rule does not fire for valid values', () => {
    const onAnomaly = vi.fn();
    const sig = anomalySignal(50, {
      builtInRules: { impossibleValue: { min: 0, max: 100 } },
      onAnomaly,
    });
    sig.set(75);
    expect(onAnomaly).not.toHaveBeenCalled();
  });

  it('suddenJump rule fires when value jumps > 3 std devs', () => {
    const onAnomaly = vi.fn();
    const sig = anomalySignal(10, {
      builtInRules: { suddenJump: true },
      onAnomaly,
    });
    // Build up a stable history
    for (let i = 0; i < 10; i++) {
      sig.set(10 + (i % 2)); // values around 10-11
    }
    onAnomaly.mockClear();
    // Now set an extreme value
    sig.set(10000);
    expect(onAnomaly).toHaveBeenCalled();
    expect(onAnomaly.mock.calls[0][0].rule).toBe('suddenJump');
    expect(onAnomaly.mock.calls[0][0].severity).toBe('high');
  });

  it('suddenJump rule does not fire for stable values', () => {
    const onAnomaly = vi.fn();
    const sig = anomalySignal(100, {
      builtInRules: { suddenJump: true },
      onAnomaly,
    });
    sig.set(101);
    sig.set(99);
    sig.set(100);
    sig.set(102);
    expect(onAnomaly).not.toHaveBeenCalled();
  });

  it('custom rules are applied on set()', () => {
    const onAnomaly = vi.fn();
    const sig = anomalySignal(5, {
      builtInRules: { suddenJump: false }, // disable built-in to isolate
      rules: [
        {
          name: 'always-flag-zero',
          severity: 'low',
          detect: (v) => v === 0,
        },
      ],
      onAnomaly,
    });
    sig.set(1);
    expect(onAnomaly).not.toHaveBeenCalled();
    sig.set(0);
    expect(onAnomaly).toHaveBeenCalledOnce();
    expect(onAnomaly.mock.calls[0][0].rule).toBe('always-flag-zero');
    expect(onAnomaly.mock.calls[0][0].severity).toBe('low');
  });

  it('offHours rule detects writes at disallowed hours', () => {
    // Mock Date to a specific hour
    const onAnomaly = vi.fn();
    const sig = anomalySignal(1, {
      builtInRules: {
        suddenJump: false,
        offHours: { startHour: 9, endHour: 17 }, // allowed 9am-5pm
      },
      onAnomaly,
    });

    // Mock Date.prototype.getHours to return 2 (2am — off hours)
    const originalGetHours = Date.prototype.getHours;
    Date.prototype.getHours = vi.fn().mockReturnValue(2);
    try {
      sig.set(2);
      expect(onAnomaly).toHaveBeenCalled();
      expect(onAnomaly.mock.calls[0][0].rule).toBe('offHours');
    } finally {
      Date.prototype.getHours = originalGetHours;
    }
  });

  it('AnomalyEvent contains value, rule, severity, timestamp, history', () => {
    const onAnomaly = vi.fn();
    const sig = anomalySignal(0, {
      builtInRules: { impossibleValue: { min: 0, max: 10 } },
      onAnomaly,
    });
    sig.set(50);
    const event = onAnomaly.mock.calls[0][0];
    expect(event).toHaveProperty('value', 50);
    expect(event).toHaveProperty('rule');
    expect(event).toHaveProperty('severity');
    expect(event).toHaveProperty('timestamp');
    expect(typeof event.timestamp).toBe('number');
    expect(Array.isArray(event.history)).toBe(true);
  });
});
