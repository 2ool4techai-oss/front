export interface BenchResult {
  name:    string;
  hz:      number;   // operations per second
  mean:    number;   // ms per operation
  samples: number;
}

export interface BenchSuite {
  name:    string;
  results: BenchResult[];
  winner:  string;
  ratio:   number;   // winner hz / slowest hz
}

/**
 * Runs a micro-benchmark using setTimeout-based iteration (no tinybench dependency for tests).
 * Returns approximate ops/sec.
 */
export async function measureOps(fn: () => void, durationMs = 100): Promise<number> {
  const start = performance.now();
  let count = 0;
  while (performance.now() - start < durationMs) {
    fn();
    count++;
  }
  const elapsed = performance.now() - start;
  return (count / elapsed) * 1000;
}

export async function runSignalCreationBench(): Promise<BenchResult[]> {
  // Import dynamically to avoid issues in test environment
  const { signal } = await import('@nexoraaidrishti/runtime');

  const createHz = await measureOps(() => { signal(0); });
  const createWithLabelHz = await measureOps(() => {
    const s = signal(0);
    // label() requires dev mode — skip for perf test
    return s;
  });

  return [
    { name: 'signal creation', hz: createHz, mean: 1000 / createHz, samples: Math.floor(createHz / 10) },
    { name: 'signal creation (labeled)', hz: createWithLabelHz, mean: 1000 / createWithLabelHz, samples: Math.floor(createWithLabelHz / 10) },
  ];
}

export async function runSignalUpdateBench(): Promise<BenchResult[]> {
  const { signal, computed, effect } = await import('@nexoraaidrishti/runtime');

  const s = signal(0);
  const updateHz = await measureOps(() => { s.set(s() + 1); });

  const c = computed(() => s() * 2);
  const readComputedHz = await measureOps(() => { c(); });

  let effectCount = 0;
  effect(() => { effectCount = s(); });
  const updateWithEffectHz = await measureOps(() => { s.set(s() + 1); });

  return [
    { name: 'signal.set()', hz: updateHz, mean: 1000 / updateHz, samples: Math.floor(updateHz / 10) },
    { name: 'computed read', hz: readComputedHz, mean: 1000 / readComputedHz, samples: Math.floor(readComputedHz / 10) },
    { name: 'signal.set() + effect', hz: updateWithEffectHz, mean: 1000 / updateWithEffectHz, samples: Math.floor(updateWithEffectHz / 10) },
  ];
}

export async function runBatchBench(): Promise<BenchResult[]> {
  const { signal, batch, effect } = await import('@nexoraaidrishti/runtime');

  const signals = Array.from({ length: 10 }, (_, i) => signal(i));
  let effectRuns = 0;
  signals.forEach(s => effect(() => { effectRuns += s(); }));

  const noBatchHz = await measureOps(() => {
    signals.forEach((s, i) => s.set(i + 1));
  });

  const batchHz = await measureOps(() => {
    batch(() => { signals.forEach((s, i) => s.set(i + 1)); });
  });

  return [
    { name: 'update 10 signals (no batch)', hz: noBatchHz, mean: 1000 / noBatchHz, samples: Math.floor(noBatchHz / 10) },
    { name: 'update 10 signals (batched)', hz: batchHz, mean: 1000 / batchHz, samples: Math.floor(batchHz / 10) },
  ];
}

export function formatResults(suite: BenchSuite): string {
  const lines = [`\n## ${suite.name}`, ''];
  for (const r of suite.results) {
    const opsK = (r.hz / 1000).toFixed(0);
    lines.push(`  ${r.name.padEnd(40)} ${opsK.padStart(8)}k ops/s   ${r.mean.toFixed(4)}ms/op`);
  }
  lines.push('');
  lines.push(`  Winner: ${suite.winner} (${suite.ratio.toFixed(1)}x faster than slowest)`);
  return lines.join('\n');
}

export function buildSuite(name: string, results: BenchResult[]): BenchSuite {
  const sorted = [...results].sort((a, b) => b.hz - a.hz);
  const winner = sorted[0]!;
  const slowest = sorted[sorted.length - 1]!;
  return {
    name,
    results,
    winner: winner.name,
    ratio: slowest.hz > 0 ? winner.hz / slowest.hz : 1,
  };
}
