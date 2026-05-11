import { runSignalCreationBench, runSignalUpdateBench, runBatchBench, buildSuite, formatResults } from './signals.bench.js';

async function main() {
  console.log('DRISHTI Performance Benchmarks');
  console.log('================================\n');
  console.log('Environment: Node.js', process.version);
  console.log('Date:', new Date().toISOString());

  const creationResults = await runSignalCreationBench();
  const creationSuite = buildSuite('Signal Creation', creationResults);
  console.log(formatResults(creationSuite));

  const updateResults = await runSignalUpdateBench();
  const updateSuite = buildSuite('Signal Updates', updateResults);
  console.log(formatResults(updateSuite));

  const batchResults = await runBatchBench();
  const batchSuite = buildSuite('Batched Updates', batchResults);
  console.log(formatResults(batchSuite));

  console.log('\n✓ Benchmarks complete');
}

main().catch(console.error);
