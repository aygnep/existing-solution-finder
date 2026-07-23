import { summarize } from '../src/core/summarizer';
import type { ParsedProblem } from '../src/types/problem';
import type { SolutionCandidate } from '../src/types/discovery';

const problem: ParsedProblem = {
  raw: 'package fails on Node.js 22',
  errorTokens: ['ERR_MODULE_NOT_FOUND'],
  stackNames: ['Node.js'],
  versions: ['Node.js 22'],
  constraints: ['no production secrets'],
  keywords: ['package'],
};

const solution: SolutionCandidate = {
  id: 'https://github.com/example/tool/issues/42',
  name: 'example/tool#42',
  url: 'https://github.com/example/tool/issues/42',
  description: 'Issue discussing the failure.',
  readmeSnippet: 'Use version 4.2 on Node.js 22.\nBearer ghp_abcdefghijklmnopqrstuvwxyz123456',
  provider: 'github',
  metadata: { repositoryUrl: 'https://github.com/example/tool' },
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
  rank: 1,
  candidateType: 'issue',
  matchReason: 'Directly references the error.',
  nextStep: 'Read the issue.',
  solutionKey: 'https://github.com/example/tool',
  evidence: [{
    sourceUrl: 'https://github.com/example/tool/issues/42',
    sourceKind: 'github',
    title: 'example/tool#42',
    excerpt: 'Use version 4.2 on Node.js 22.\nBearer ghp_abcdefghijklmnopqrstuvwxyz123456',
    retrievedAt: '2026-07-23T00:00:00.000Z',
  }],
  relatedCandidates: [],
  validationSteps: [
    {
      id: 'verify-independent-sources',
      instruction: 'Verify against two independent sources.',
      expectedObservation: 'The sources agree.',
    },
    {
      id: 'propose-isolated-test',
      instruction: 'Propose an isolated reproduction.',
      expectedObservation: 'The failure is reproduced safely.',
    },
  ],
};

describe('agent-facing human summary', () => {
  it('shows provider evidence excerpts and concrete validation steps', () => {
    const output = summarize([solution], problem);

    expect(output).toContain('Source evidence:');
    expect(output).toContain('[github] https://github.com/example/tool/issues/42');
    expect(output).toContain('Use version 4.2 on Node.js 22.');
    expect(output).toContain('Validation loop:');
    expect(output).toContain('Verify against two independent sources.');
    expect(output).toContain('Expected observation: The sources agree.');
  });

  it('redacts obvious tokens without paraphrasing the rest of source text', () => {
    const output = summarize([solution], problem);

    expect(output).toContain('Use version 4.2 on Node.js 22.');
    expect(output).toContain('Bearer [REDACTED]');
    expect(output).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz123456');
  });

  it('bounds long evidence while preserving an exact source prefix', () => {
    const prefix = 'Exact source prefix that must remain unchanged.';
    const longExcerpt = `${prefix}${'x'.repeat(2_000)}`;
    const withLongEvidence: SolutionCandidate = {
      ...solution,
      evidence: [{ ...solution.evidence[0]!, excerpt: longExcerpt }],
    };
    const output = summarize([withLongEvidence], problem);

    expect(output).toContain(prefix);
    expect(output).toContain('[Excerpt truncated; open the source for full context]');
    expect(output).not.toContain('x'.repeat(1_300));
  });
});
