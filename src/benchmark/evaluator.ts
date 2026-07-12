import type { BenchmarkCase } from './types.js';

export function parseBenchmarkCases(input: readonly BenchmarkCase[]): readonly BenchmarkCase[] {
  for (const benchmarkCase of input) {
    if (benchmarkCase.approvedCandidates.length === 0) {
      throw new Error(
        `Benchmark case "${benchmarkCase.id}" must define at least one approved candidate matcher.`,
      );
    }
  }

  return input;
}
