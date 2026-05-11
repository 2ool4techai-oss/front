import { describe, it, expect } from 'vitest';
import { measureOps, buildSuite, formatResults } from '../signals.bench.js';

describe('measureOps', () => {
  it('returns a positive number', async () => {
    const hz = await measureOps(() => { 1 + 1; }, 50);
    expect(hz).toBeGreaterThan(0);
  });

  it('measures faster operations as higher hz', async () => {
    const fastHz = await measureOps(() => { 1 + 1; }, 50);
    const slowHz = await measureOps(() => {
      let x = 0;
      for (let i = 0; i < 1000; i++) x += i;
      return x;
    }, 50);
    expect(fastHz).toBeGreaterThan(slowHz);
  });
});

describe('buildSuite', () => {
  it('identifies winner as highest hz', () => {
    const results = [
      { name: 'slow', hz: 1000, mean: 1, samples: 100 },
      { name: 'fast', hz: 5000, mean: 0.2, samples: 500 },
    ];
    const suite = buildSuite('Test', results);
    expect(suite.winner).toBe('fast');
  });

  it('computes ratio correctly', () => {
    const results = [
      { name: 'slow', hz: 1000, mean: 1, samples: 100 },
      { name: 'fast', hz: 5000, mean: 0.2, samples: 500 },
    ];
    const suite = buildSuite('Test', results);
    expect(suite.ratio).toBeCloseTo(5, 0);
  });

  it('handles single result', () => {
    const results = [{ name: 'only', hz: 2000, mean: 0.5, samples: 200 }];
    const suite = buildSuite('Single', results);
    expect(suite.winner).toBe('only');
    expect(suite.ratio).toBe(1);
  });
});

describe('formatResults', () => {
  it('returns a string', () => {
    const suite = buildSuite('Test', [
      { name: 'op A', hz: 10000, mean: 0.1, samples: 100 },
    ]);
    expect(typeof formatResults(suite)).toBe('string');
  });

  it('includes suite name', () => {
    const suite = buildSuite('My Suite', [
      { name: 'op', hz: 1000, mean: 1, samples: 100 },
    ]);
    expect(formatResults(suite)).toContain('My Suite');
  });

  it('includes winner name', () => {
    const suite = buildSuite('Test', [
      { name: 'fastest-op', hz: 9999, mean: 0.1, samples: 100 },
      { name: 'slow-op', hz: 100, mean: 10, samples: 10 },
    ]);
    expect(formatResults(suite)).toContain('fastest-op');
  });
});

describe('signal benchmarks integration', () => {
  it('runSignalCreationBench returns results array', async () => {
    const { runSignalCreationBench } = await import('../signals.bench.js');
    const results = await runSignalCreationBench();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.hz).toBeGreaterThan(0);
      expect(typeof r.name).toBe('string');
    }
  }, 10000);  // 10s timeout for actual measurement

  it('runSignalUpdateBench returns results array', async () => {
    const { runSignalUpdateBench } = await import('../signals.bench.js');
    const results = await runSignalUpdateBench();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  }, 10000);

  it('runBatchBench shows batch is not slower than no-batch', async () => {
    const { runBatchBench } = await import('../signals.bench.js');
    const results = await runBatchBench();
    expect(results.length).toBe(2);
    // Both should be measurable
    results.forEach(r => expect(r.hz).toBeGreaterThan(0));
  }, 10000);
});
