import {
  compareWithBaseline,
  evaluateCase,
  parseBenchmarkCases,
} from '../src/benchmark/evaluator';
import type { BenchmarkRunReport } from '../src/benchmark/types';
import type { DiscoveryResult, SolutionCandidate } from '../src/types/discovery';
import type { BenchmarkCase } from '../src/benchmark/types';

describe('parseBenchmarkCases', () => {
  it('rejects a case without an approved candidate matcher', () => {
    expect(() => parseBenchmarkCases([{
      id: 'missing-matcher',
      problem: 'vite module not found',
      stack: [],
      constraints: [],
      providers: ['github'],
      maxResults: 5,
      topN: 3,
      requiredProviders: ['github'],
      approvedCandidates: [],
    }])).toThrow('must define at least one approved candidate matcher');
  });
});

const benchmarkCase: BenchmarkCase = {
  id: 'known-solution',
  problem: 'reasoning_content error',
  stack: ['Claude Code'],
  constraints: [],
  providers: ['github'],
  maxResults: 5,
  topN: 1,
  requiredProviders: ['github'],
  approvedCandidates: [{ name: 'known-solution' }],
};

describe('evaluateCase', () => {
  it('passes relevance when an approved name occurs in the top candidates', () => {
    const report = evaluateCase(benchmarkCase, resultWith(candidate()), 125);

    expect(report.relevance.passed).toBe(true);
    expect(report.elapsedMs).toBe(125);
    expect(report.providerCoverage).toEqual({ completedWithResults: 1, configured: 1 });
    expect(report.outcome).toBe('passed');
  });

  it('redacts credential-shaped text from provider failures', () => {
    const report = evaluateCase(benchmarkCase, resultWith(candidate(), {
      provider: 'github',
      state: 'failed',
      resultCount: 0,
      message: 'token ghp_exampleToken',
    }), 20);

    expect(report.providers[0]?.message).toBe('token [REDACTED]');
    expect(report.outcome).toBe('inconclusive');
  });

  it('fails visible safety when a risky candidate has no warning', () => {
    const report = evaluateCase(benchmarkCase, resultWith(candidate({
      score: {
        ...candidate().score,
        trustLevel: 'BLOCKED',
        warnings: [],
      },
    })), 20);

    expect(report.safety.passed).toBe(false);
    expect(report.outcome).toBe('failed');
  });

  it('fails a conclusive search that misses the approved top candidate', () => {
    const report = evaluateCase(benchmarkCase, resultWith(candidate({ name: 'unrelated' })), 20);
    expect(report.relevance.passed).toBe(false);
    expect(report.outcome).toBe('failed');
  });
});

describe('compareWithBaseline', () => {
  it('reports regression when a baseline relevance pass becomes a failure', () => {
    const baseline = runReport({ relevance: { passed: true } });
    const current = runReport({ relevance: { passed: false } });

    expect(compareWithBaseline(current, baseline).outcome).toBe('regressed');
  });

  it('reports an inconclusive run separately from a regression', () => {
    const baseline = runReport({ relevance: { passed: true } });
    const current = runReport({ outcome: 'inconclusive' });

    expect(compareWithBaseline(current, baseline).outcome).toBe('inconclusive');
  });

  it('does not pass an existing relevance miss just because the baseline also missed', () => {
    const baseline = runReport({ relevance: { passed: false }, outcome: 'passed' });
    const current = runReport({ relevance: { passed: false }, outcome: 'failed' });
    expect(compareWithBaseline(current, baseline).outcome).toBe('failed');
  });

  it('does not fail when a run finds an additional candidate', () => {
    const baseline = runReport();
    const current = runReport({ candidates: [candidate(), candidate({
      id: 'https://example.com/additional',
      url: 'https://example.com/additional',
      name: 'additional',
    })].map((item) => ({
      url: item.url,
      name: item.name,
      provider: item.provider,
      score: item.score.displayTotal,
      trustLevel: item.score.trustLevel,
      penaltyCount: item.score.penalties.length,
      warningCategories: item.score.warnings.map((warning) => warning.category),
    })) });

    expect(compareWithBaseline(current, baseline).outcome).toBe('passed');
  });
});

function resultWith(
  candidateValue: SolutionCandidate,
  status: DiscoveryResult['providerStatus'][number] = {
    provider: 'github',
    state: 'complete',
    resultCount: 1,
  },
): DiscoveryResult {
  return {
    request: {
      problem: 'reasoning_content error',
      stack: [],
      constraints: [],
      providers: ['github'],
      mode: 'real',
      maxResults: 5,
    },
    parsedProblem: {
      raw: '',
      errorTokens: [],
      stackNames: [],
      versions: [],
      constraints: [],
      keywords: [],
    },
    searchPlan: [],
    providerStatus: [status],
    candidates: [candidateValue],
    completedAt: '2026-07-12T00:00:00.000Z',
  };
}

function candidate(overrides: Partial<SolutionCandidate> = {}): SolutionCandidate {
  return {
    id: 'https://example.com/known-solution',
    solutionKey: 'https://example.com/known-solution',
    name: 'known-solution',
    url: 'https://example.com/known-solution',
    description: 'A solution',
    provider: 'github',
    metadata: {},
    evidence: [],
    relatedCandidates: [],
    validationSteps: [],
    rank: 1,
    candidateType: 'tool',
    matchReason: 'Matches the error.',
    nextStep: 'Review the documentation.',
    score: {
      breakdown: {
        exactErrorMatch: 25,
        stackMatch: 20,
        readmeEvidence: 15,
        recency: 10,
        installationClarity: 10,
        maintenanceActivity: 10,
        exampleConfig: 10,
      },
      penalties: [],
      subtotal: 100,
      total: 100,
      displayTotal: 100,
      trustLevel: 'HIGH',
      warnings: [],
    },
    ...overrides,
  };
}

function runReport(
  overrides: Partial<BenchmarkRunReport['cases'][number]> = {},
): BenchmarkRunReport {
  return {
    cases: [{
      id: 'known-solution',
      requiredProviders: ['github'],
      relevance: { passed: true },
      safety: { passed: true },
      providerCoverage: { configured: 1, completedWithResults: 1 },
      outcome: 'passed',
      elapsedMs: 20,
      providers: [{ provider: 'github', state: 'complete', resultCount: 1 }],
      candidates: [{
        url: 'https://example.com/known-solution',
        name: 'known-solution',
        provider: 'github',
        score: 100,
        trustLevel: 'HIGH',
        penaltyCount: 0,
        warningCategories: [],
      }],
      ...overrides,
    }],
  };
}
