import { readFile, writeFile } from 'node:fs/promises';
import { discoverSolutions, type DiscoverySearchers } from '../core/discovery-service.js';
import { createDiscoverySearchers } from '../providers/discovery-searchers.js';
import type { BenchmarkCase, BenchmarkComparison, BenchmarkRunReport } from './types.js';
import { compareWithBaseline, evaluateCase, parseBenchmarkCases } from './evaluator.js';

const CASES_PATH = 'benchmarks/cases.json';
const BASELINE_PATH = 'benchmarks/baseline.json';

export interface BenchmarkIo {
  writeStdout(text: string): void;
  writeStderr(text: string): void;
}

export interface BenchmarkDependencies {
  readonly readFile: (path: string) => Promise<string>;
  readonly writeFile: (path: string, contents: string) => Promise<void>;
  readonly createSearchers: () => Promise<DiscoverySearchers>;
  readonly discover: typeof discoverSolutions;
  readonly now: () => Date;
}

export async function runBenchmark(
  args: readonly string[],
  io: BenchmarkIo = defaultIo(),
  dependencies: BenchmarkDependencies = defaultDependencies(),
): Promise<number> {
  if (!args.every((arg) => arg === '--update-baseline')) {
    io.writeStderr('Unknown benchmark option. Supported option: --update-baseline\n');
    return 1;
  }

  const updateBaseline = args.includes('--update-baseline');
  const cases = parseBenchmarkCases(
    JSON.parse(await dependencies.readFile(CASES_PATH)) as BenchmarkCase[],
  );
  const report = await evaluateRun(cases, dependencies);
  const baseline = await readBaseline(dependencies);
  const comparison = baseline === undefined
    ? comparisonWithoutBaseline(report)
    : compareWithBaseline(report, baseline);

  io.writeStdout(JSON.stringify({ report, comparison }, null, 2) + '\n');

  if (updateBaseline) {
    if (comparison.outcome !== 'passed') {
      io.writeStderr(`Benchmark baseline was not updated: ${comparison.outcome}.\n`);
      return exitCodeFor(comparison);
    }
    await dependencies.writeFile(BASELINE_PATH, JSON.stringify(report, null, 2) + '\n');
    return 0;
  }

  if (baseline === undefined) {
    io.writeStderr('No approved benchmark baseline exists. Review the report, then run with --update-baseline.\n');
    return 1;
  }

  if (comparison.outcome !== 'passed') {
    io.writeStderr(`Benchmark is ${comparison.outcome}: ${comparison.reasons.join(' ')}\n`);
  }
  return exitCodeFor(comparison);
}

async function evaluateRun(
  cases: readonly BenchmarkCase[],
  dependencies: BenchmarkDependencies,
): Promise<BenchmarkRunReport> {
  const searchers = await dependencies.createSearchers();
  const reports = [];

  for (const benchmarkCase of cases) {
    const startedAt = dependencies.now();
    const result = await dependencies.discover({
      request: {
        problem: benchmarkCase.problem,
        stack: benchmarkCase.stack,
        constraints: benchmarkCase.constraints,
        providers: benchmarkCase.providers,
        mode: 'real',
        maxResults: benchmarkCase.maxResults,
      },
      now: startedAt,
      searchers,
    });
    const elapsedMs = Math.max(0, dependencies.now().getTime() - startedAt.getTime());
    reports.push(evaluateCase(benchmarkCase, result, elapsedMs));
  }

  return { cases: reports };
}

async function readBaseline(
  dependencies: BenchmarkDependencies,
): Promise<BenchmarkRunReport | undefined> {
  try {
    return JSON.parse(await dependencies.readFile(BASELINE_PATH)) as BenchmarkRunReport;
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
}

function comparisonWithoutBaseline(report: BenchmarkRunReport): BenchmarkComparison {
  if (report.cases.some((benchmarkCase) => benchmarkCase.outcome === 'inconclusive')) {
    return {
      outcome: 'inconclusive',
      reasons: ['At least one required provider did not complete with results.'],
    };
  }
  const failed = report.cases.filter((benchmarkCase) => benchmarkCase.outcome === 'failed');
  if (failed.length > 0) {
    return { outcome: 'failed', reasons: failed.map((benchmarkCase) => `Quality target missed for "${benchmarkCase.id}".`) };
  }
  return { outcome: 'passed', reasons: [] };
}

function exitCodeFor(comparison: BenchmarkComparison): number {
  if (comparison.outcome === 'passed') return 0;
  return comparison.outcome === 'regressed' || comparison.outcome === 'failed' ? 2 : 3;
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function defaultDependencies(): BenchmarkDependencies {
  return {
    readFile: (path) => readFile(path, 'utf8'),
    writeFile,
    createSearchers: () => createDiscoverySearchers('real'),
    discover: discoverSolutions,
    now: () => new Date(),
  };
}

function defaultIo(): BenchmarkIo {
  return {
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text),
  };
}

if (require.main === module) {
  void runBenchmark(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
