import type { DiscoveryResult } from '../types/discovery.js';
import type {
  BenchmarkCandidateRecord,
  BenchmarkCase,
  BenchmarkCaseReport,
  BenchmarkComparison,
  BenchmarkOutcome,
  BenchmarkRunReport,
} from './types.js';

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

export function evaluateCase(
  benchmarkCase: BenchmarkCase,
  result: DiscoveryResult,
  elapsedMs: number,
): BenchmarkCaseReport {
  const candidates = result.candidates.map((candidate) => ({
    url: candidate.url,
    name: candidate.name,
    provider: candidate.provider,
    score: candidate.score.displayTotal,
    trustLevel: candidate.score.trustLevel,
    penaltyCount: candidate.score.penalties.length,
    warningCategories: candidate.score.warnings.map((warning) => warning.category),
  }));
  const topCandidates = candidates.slice(0, benchmarkCase.topN);
  const relevancePassed = benchmarkCase.approvedCandidates.some((matcher) =>
    topCandidates.some((candidate) => matchesCandidate(candidate, matcher)),
  );
  const providers = result.providerStatus.map((status) => ({
    ...status,
    message: status.message === undefined ? undefined : redact(status.message),
  }));

  return {
    id: benchmarkCase.id,
    requiredProviders: benchmarkCase.requiredProviders,
    relevance: { passed: relevancePassed },
    safety: {
      passed: candidates.every((candidate) =>
        !hasRiskSignal(candidate) || candidate.warningCategories.length > 0,
      ),
    },
    providerCoverage: {
      configured: benchmarkCase.providers.length,
      completedWithResults: providers.filter(
        (status) => status.state === 'complete' && status.resultCount > 0,
      ).length,
    },
    outcome: determineOutcome(benchmarkCase, result),
    elapsedMs,
    providers,
    candidates,
  };
}

function matchesCandidate(
  candidate: BenchmarkCandidateRecord,
  matcher: BenchmarkCase['approvedCandidates'][number],
): boolean {
  return (matcher.url !== undefined && candidate.url === matcher.url) ||
    (matcher.name !== undefined && candidate.name === matcher.name);
}

function hasRiskSignal(candidate: BenchmarkCandidateRecord): boolean {
  return candidate.trustLevel === 'BLOCKED' || candidate.penaltyCount > 0;
}

function determineOutcome(benchmarkCase: BenchmarkCase, result: DiscoveryResult): BenchmarkOutcome {
  const providerIsUnavailable = benchmarkCase.requiredProviders.some((provider) => {
    const status = result.providerStatus.find((item) => item.provider === provider);
    return status?.state !== 'complete' || status.resultCount === 0;
  });

  return providerIsUnavailable ? 'inconclusive' : 'passed';
}

function redact(value: string): string {
  return value
    .replace(/ghp_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]');
}

export function compareWithBaseline(
  current: BenchmarkRunReport,
  baseline: BenchmarkRunReport,
): BenchmarkComparison {
  if (current.cases.some((benchmarkCase) => benchmarkCase.outcome === 'inconclusive')) {
    return {
      outcome: 'inconclusive',
      reasons: ['At least one required provider did not complete with results.'],
    };
  }

  const reasons = baseline.cases.flatMap((previous) => {
    const next = current.cases.find((benchmarkCase) => benchmarkCase.id === previous.id);
    if (!next) return [`Missing benchmark case "${previous.id}".`];
    if (previous.relevance.passed && !next.relevance.passed) {
      return [`Relevance regressed for "${previous.id}".`];
    }
    if (previous.safety.passed && !next.safety.passed) {
      return [`Safety visibility regressed for "${previous.id}".`];
    }
    if (requiredProviderCoverageRegressed(previous, next)) {
      return [`Required provider coverage regressed for "${previous.id}".`];
    }
    return [];
  });

  return reasons.length === 0
    ? { outcome: 'passed', reasons: [] }
    : { outcome: 'regressed', reasons };
}

function requiredProviderCoverageRegressed(
  previous: BenchmarkCaseReport,
  next: BenchmarkCaseReport,
): boolean {
  return previous.requiredProviders.some((provider) => {
    const previousStatus = previous.providers.find((status) => status.provider === provider);
    const nextStatus = next.providers.find((status) => status.provider === provider);
    return previousStatus?.state === 'complete' &&
      previousStatus.resultCount > 0 &&
      (nextStatus?.state !== 'complete' || nextStatus.resultCount === 0);
  });
}
