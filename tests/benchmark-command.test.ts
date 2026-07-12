import { runBenchmark, type BenchmarkDependencies } from '../src/benchmark';
import { readFileSync } from 'node:fs';
import type { DiscoveryResult, SolutionCandidate } from '../src/types/discovery';
import type { BenchmarkCase, BenchmarkRunReport } from '../src/benchmark/types';

const benchmarkCase: BenchmarkCase = {
  id: 'known-solution',
  problem: 'known error',
  stack: [],
  constraints: [],
  providers: ['github'],
  maxResults: 5,
  topN: 1,
  requiredProviders: ['github'],
  approvedCandidates: [{ name: 'known-solution' }],
};

describe('runBenchmark', () => {
  it('returns an inconclusive exit code when a required provider is unavailable', async () => {
    const io = createIo();
    const exitCode = await runBenchmark([], io, dependencies(
      result({ provider: 'github', state: 'skipped', resultCount: 0, message: 'token ghp_exampleToken' }),
      baseline(),
    ));

    expect(exitCode).toBe(3);
    expect(io.stderr).toContain('inconclusive');
    expect(io.stdout).toContain('[REDACTED]');
  });

  it('does not write a baseline without --update-baseline', async () => {
    const io = createIo();
    const benchmarkDependencies = dependencies(result(), baseline());

    await runBenchmark([], io, benchmarkDependencies);

    expect(benchmarkDependencies.writeFile).not.toHaveBeenCalled();
  });

  it('writes a redacted baseline only with --update-baseline', async () => {
    const io = createIo();
    const benchmarkDependencies = dependencies(result({
      provider: 'github',
      state: 'complete',
      resultCount: 1,
      message: 'token ghp_exampleToken',
    }));

    const exitCode = await runBenchmark(['--update-baseline'], io, benchmarkDependencies);

    expect(exitCode).toBe(0);
    expect(benchmarkDependencies.writeFile).toHaveBeenCalledWith(
      'benchmarks/baseline.json',
      expect.stringContaining('[REDACTED]'),
    );
  });
});

describe('benchmark documentation', () => {
  it('documents the real benchmark command and explicit update operation', () => {
    const readme = readFileSync('README.md', 'utf8');

    expect(readme).toContain('npm run benchmark:real');
    expect(readme).toContain('npm run benchmark:update');
  });
});

function createIo(): { stdout: string; stderr: string; writeStdout: (text: string) => void; writeStderr: (text: string) => void } {
  const io = {
    stdout: '',
    stderr: '',
    writeStdout(text: string) { this.stdout += text; },
    writeStderr(text: string) { this.stderr += text; },
  };
  return io;
}

function dependencies(
  discoveryResult: DiscoveryResult,
  existingBaseline?: BenchmarkRunReport,
): jest.Mocked<BenchmarkDependencies> {
  return {
    readFile: jest.fn(async (path: string) => {
      if (path === 'benchmarks/cases.json') return JSON.stringify([benchmarkCase]);
      if (existingBaseline !== undefined && path === 'benchmarks/baseline.json') {
        return JSON.stringify(existingBaseline);
      }
      const error = new Error('missing') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }),
    writeFile: jest.fn(async (_path: string, _contents: string) => undefined),
    createSearchers: jest.fn(async () => ({
      github: async () => [],
      npm: async () => [],
      web: async () => [],
    })),
    discover: jest.fn(async (_options) => discoveryResult),
    now: jest.fn(() => new Date('2026-07-12T00:00:00.000Z')),
  };
}

function baseline(): BenchmarkRunReport {
  return {
    cases: [{
      id: 'known-solution',
      requiredProviders: ['github'],
      relevance: { passed: true },
      safety: { passed: true },
      providerCoverage: { configured: 1, completedWithResults: 1 },
      outcome: 'passed',
      elapsedMs: 0,
      providers: [{ provider: 'github', state: 'complete', resultCount: 1 }],
      candidates: [],
    }],
  };
}

function result(
  status: DiscoveryResult['providerStatus'][number] = {
    provider: 'github',
    state: 'complete',
    resultCount: 1,
  },
): DiscoveryResult {
  return {
    request: {
      problem: 'known error',
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
    candidates: [candidate()],
    completedAt: '2026-07-12T00:00:00.000Z',
  };
}

function candidate(): SolutionCandidate {
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
  };
}
