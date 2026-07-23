import { groupSolutions } from '../src/core/solution-grouper';
import type { RankedCandidate } from '../src/types/score';

const score = {
  breakdown: {
    exactErrorMatch: 25, stackMatch: 20, readmeEvidence: 15, recency: 10,
    installationClarity: 10, maintenanceActivity: 10, exampleConfig: 10,
  },
  penalties: [], subtotal: 100, total: 100, displayTotal: 100,
  trustLevel: 'HIGH' as const, warnings: [],
};

function candidate(overrides: Partial<RankedCandidate>): RankedCandidate {
  return {
    id: 'https://github.com/example/tool',
    name: 'example/tool',
    url: 'https://github.com/example/tool',
    description: 'Example tool',
    provider: 'github',
    metadata: { repositoryUrl: 'https://github.com/example/tool' },
    score,
    rank: 1,
    candidateType: 'tool',
    matchReason: 'Direct match.',
    nextStep: 'Read the source.',
    ...overrides,
  };
}

describe('groupSolutions', () => {
  it('groups a repository and its issue by repository URL', () => {
    const groups = groupSolutions([
      candidate({}),
      candidate({
        id: 'https://github.com/example/tool/issues/12',
        name: 'example/tool#12',
        url: 'https://github.com/example/tool/issues/12',
        candidateType: 'issue',
        rank: 2,
      }),
    ], new Date('2026-07-10T00:00:00Z'));

    expect(groups).toHaveLength(1);
    expect(groups[0]!.evidence).toHaveLength(2);
    expect(groups[0]!.relatedCandidates).toHaveLength(2);
    expect(groups[0]!.validationSteps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        'verify-independent-sources',
        'check-versions-constraints',
        'propose-isolated-test',
        'propose-rollback',
        'record-observed-result',
        'refine-or-research',
      ]),
    );
  });

  it('preserves source excerpts verbatim', () => {
    const excerpt = 'First line from source.\n  Second line with source indentation.';
    const groups = groupSolutions([
      candidate({ readmeSnippet: excerpt }),
    ], new Date('2026-07-10T00:00:00Z'));

    expect(groups[0]!.evidence[0]!.excerpt).toBe(excerpt);
  });
});
