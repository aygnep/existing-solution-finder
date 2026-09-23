import { discoverSolutions } from '../src/core/discovery-service';
import { runQueryBatch } from '../src/providers/discovery-searchers';
import type { RawCandidate } from '../src/types/candidate';
import type { Query } from '../src/types/candidate';

const npmCandidate: RawCandidate = {
  id: 'https://www.npmjs.com/package/vite-helper',
  name: 'vite-helper',
  url: 'https://www.npmjs.com/package/vite-helper',
  description: 'A maintained helper for Vite module resolution.',
  provider: 'npm',
  metadata: {
    lastCommitDate: new Date('2026-07-01T00:00:00Z'),
    license: 'MIT',
    hasInstallInstructions: true,
  },
};

describe('discovery service', () => {
  it('labels local Laya judgments without presenting them as hosted Jev', async () => {
    const result = await discoverSolutions({
      request: { problem: 'vite module not found', stack: [], constraints: [], providers: ['npm'], mode: 'real', maxResults: 2, reranker: 'laya' },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: { github: async () => [], web: async () => [], npm: async () => [npmCandidate] },
      reranker: { evaluate: async ({ candidates }) => ({
        model: 'laya/english',
        judgments: candidates.map((candidate) => ({
          solutionKey: candidate.solutionKey, relevanceProbability: 0.75,
          compatibilityProbability: 0.80, evidenceProbability: 0.60, model: 'laya/english',
        })),
      }) },
    });

    expect(result.reranking).toMatchObject({ provider: 'laya', state: 'complete', model: 'laya/english' });
    expect(result.handoff?.[0]?.decision).toMatchObject({ provider: 'laya', model: 'laya/english', relevanceProbability: 0.75 });
  });

  it('retains the rule leader when Laya assigns it a lower probability', async () => {
    const weaker: RawCandidate = { ...npmCandidate,
      id: 'https://www.npmjs.com/package/secondary-fix', url: 'https://www.npmjs.com/package/secondary-fix',
      name: 'secondary-fix', metadata: { license: 'MIT' },
    };
    const result = await discoverSolutions({
      request: { problem: 'vite module not found', stack: [], constraints: [], providers: ['npm'], mode: 'real', maxResults: 2, reranker: 'laya' },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: { github: async () => [], web: async () => [], npm: async () => [npmCandidate, weaker] },
      reranker: { evaluate: async ({ candidates }) => ({
        model: 'laya/english', judgments: candidates.map((candidate) => ({
          solutionKey: candidate.solutionKey,
          relevanceProbability: candidate.name === 'vite-helper' ? 0.20 : 0.95,
          compatibilityProbability: 0.90, evidenceProbability: 0.80, model: 'laya/english',
        })),
      }) },
    });

    expect(result.reranking?.strategy).toBe('rule-anchor');
    expect(result.handoff?.map((item) => item.name)).toEqual(['vite-helper', 'secondary-fix']);
    expect(result.handoff?.[0]?.decision?.relevanceProbability).toBe(0.20);
  });

  it('never calls Jev unless the request opts in', async () => {
    const evaluate = jest.fn();
    const result = await discoverSolutions({
      request: { problem: 'vite module not found', stack: [], constraints: [], providers: ['npm'], mode: 'real', maxResults: 2 },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: { github: async () => [], web: async () => [], npm: async () => [npmCandidate] },
      reranker: { evaluate },
    });

    expect(evaluate).not.toHaveBeenCalled();
    expect(result.reranking?.state).toBe('disabled');
  });

  it('uses Jev judgments to rerank a wider shortlist before the final handoff', async () => {
    const candidates: RawCandidate[] = [
      npmCandidate,
      { ...npmCandidate, id: 'https://www.npmjs.com/package/specific-fix', url: 'https://www.npmjs.com/package/specific-fix', name: 'specific-fix', description: 'An interop fix', metadata: { license: 'MIT' } },
      { ...npmCandidate, id: 'https://www.npmjs.com/package/incompatible-fix', url: 'https://www.npmjs.com/package/incompatible-fix', name: 'incompatible-fix', description: 'Requires an unavailable runtime', metadata: { license: 'MIT' } },
      { ...npmCandidate, id: 'https://www.npmjs.com/package/archived-fix', url: 'https://www.npmjs.com/package/archived-fix', name: 'archived-fix', metadata: { isArchived: true } },
    ];
    const evaluate = jest.fn(async (input: { candidates: readonly { solutionKey: string; name: string }[] }) => ({
      model: 'jev-1.13.0',
      judgments: input.candidates.map((candidate) => ({
        solutionKey: candidate.solutionKey,
        relevanceProbability: candidate.name === 'specific-fix' ? 0.95 : candidate.name === 'archived-fix' || candidate.name === 'incompatible-fix' ? 0.99 : 0.40,
        compatibilityProbability: candidate.name === 'specific-fix' ? 0.90 : candidate.name === 'incompatible-fix' ? 0.10 : 0.60,
        evidenceProbability: candidate.name === 'specific-fix' ? 0.85 : 0.30,
        model: 'jev-1.13.0',
      })),
    }));
    const result = await discoverSolutions({
      request: { problem: 'vite module not found', stack: [], constraints: [], providers: ['npm'], mode: 'real', maxResults: 2, reranker: 'jev' },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: { github: async () => [], web: async () => [], npm: async () => candidates },
      reranker: { evaluate },
    });

    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ candidates: expect.arrayContaining([
      expect.objectContaining({ name: 'specific-fix' }),
    ]) }));
    expect(result.reranking).toMatchObject({ state: 'complete', model: 'jev-1.13.0', evaluatedCount: 4 });
    expect(result.candidates[0]?.name).toBe('specific-fix');
    expect(result.candidates[0]?.decision?.relevanceProbability).toBe(0.95);
    expect(result.candidates[0]?.decision?.provider).toBe('jev');
    expect(result.handoff?.map((item) => item.name)).toEqual(['specific-fix', 'vite-helper']);
    expect(result.handoff?.some((item) => item.name === 'archived-fix')).toBe(false);
    expect(result.handoff?.some((item) => item.name === 'incompatible-fix')).toBe(false);
  });

  it('keeps rule ranking when Jev is unavailable or fails', async () => {
    const request = { problem: 'vite module not found', stack: [], constraints: [], providers: ['npm'] as const, mode: 'real' as const, maxResults: 1, reranker: 'jev' as const };
    const searchers = { github: async () => [], web: async () => [], npm: async () => [npmCandidate] };
    const options = { request, now: new Date('2026-07-10T00:00:00Z'), searchers };

    const missingKey = await discoverSolutions(options);
    const failed = await discoverSolutions({ ...options, reranker: { evaluate: async () => { throw new Error('provider secret'); } } });

    expect(missingKey.reranking?.state).toBe('skipped');
    expect(failed.reranking?.state).toBe('failed');
    expect(failed.reranking?.message).not.toContain('secret');
    expect(missingKey.handoff?.[0]?.name).toBe('vite-helper');
    expect(failed.handoff?.[0]?.name).toBe('vite-helper');
  });

  it('bounds Jev calls while preserving a larger requested result list', async () => {
    const candidates = Array.from({ length: 35 }, (_, index): RawCandidate => ({
      ...npmCandidate,
      id: `https://www.npmjs.com/package/fix-${index}`,
      url: `https://www.npmjs.com/package/fix-${index}`,
      name: `fix-${index}`,
    }));
    let evaluatedCount = 0;
    const result = await discoverSolutions({
      request: { problem: 'vite module not found', stack: [], constraints: [], providers: ['npm'], mode: 'real', maxResults: 35, reranker: 'jev' },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: { github: async () => [], web: async () => [], npm: async () => candidates },
      reranker: { evaluate: async ({ candidates: shortlist }) => {
        evaluatedCount = shortlist.length;
        return { model: 'jev-1.13.0', judgments: shortlist.map((candidate) => ({
          solutionKey: candidate.solutionKey, relevanceProbability: 0.5, compatibilityProbability: 0.5, evidenceProbability: 0.5, model: 'jev-1.13.0',
        })) };
      } },
    });

    expect(evaluatedCount).toBe(30);
    expect(result.candidates).toHaveLength(35);
  });

  it('keeps distinct npm packages from the same repository as separate solutions', async () => {
    const packages = [
      { ...npmCandidate, id: 'https://www.npmjs.com/package/first', name: 'first', metadata: { repositoryUrl: 'https://github.com/example/monorepo' } },
      { ...npmCandidate, id: 'https://www.npmjs.com/package/second', name: 'second', metadata: { repositoryUrl: 'https://github.com/example/monorepo' } },
    ];
    const result = await discoverSolutions({
      request: { problem: 'npm package module interop', stack: [], constraints: [], providers: ['npm'], mode: 'real', maxResults: 2 },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: { github: async () => [], web: async () => [], npm: async () => packages },
    });
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((candidate) => candidate.solutionKey)).toEqual([
      'https://www.npmjs.com/package/first',
      'https://www.npmjs.com/package/second',
    ]);
  });

  it('groups related evidence before applying the result limit', async () => {
    const related = [
      { ...npmCandidate, id: 'https://github.com/example/tool', url: 'https://github.com/example/tool', name: 'tool', provider: 'github' as const, metadata: { repositoryUrl: 'https://github.com/example/tool', license: 'MIT' } },
      { ...npmCandidate, id: 'https://github.com/example/tool/issues/1', url: 'https://github.com/example/tool/issues/1', name: 'tool issue', provider: 'github' as const, candidateTypeHint: 'issue' as const, metadata: { repositoryUrl: 'https://github.com/example/tool' } },
      { ...npmCandidate, id: 'https://github.com/example/other', url: 'https://github.com/example/other', name: 'other', provider: 'github' as const, metadata: { repositoryUrl: 'https://github.com/example/other', license: 'MIT' } },
    ];
    const result = await discoverSolutions({
      request: { problem: 'vite module not found', stack: [], constraints: [], providers: ['github'], mode: 'real', maxResults: 2 },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: { github: async () => related, web: async () => [], npm: async () => [] },
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((candidate) => candidate.solutionKey)).toEqual(expect.arrayContaining([
      'https://github.com/example/tool',
      'https://github.com/example/other',
    ]));
    expect(result.candidates.find((candidate) => candidate.solutionKey.endsWith('/tool'))?.evidence).toHaveLength(2);
  });

  it('retains successful query results when a sibling query fails', async () => {
    const queries: Query[] = [
      { text: 'good', category: 'alternatives', providers: ['npm'] },
      { text: 'bad', category: 'alternatives', providers: ['npm'] },
    ];
    const batch = await runQueryBatch(queries, async (query) => {
      if (query.text === 'bad') throw new Error('timeout');
      return [npmCandidate];
    });

    expect(batch).toMatchObject({ state: 'partial', raw: [npmCandidate] });
    const result = await discoverSolutions({
      request: { problem: 'vite module not found', stack: [], constraints: [], providers: ['npm'], mode: 'real', maxResults: 5 },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: { github: async () => [], web: async () => [], npm: async () => batch },
    });
    expect(result.providerStatus[0]).toMatchObject({ state: 'partial', resultCount: 1 });
    expect(result.candidates).toHaveLength(1);
  });

  it('keeps npm results when GitHub is rate limited', async () => {
    const result = await discoverSolutions({
      request: {
        problem: 'vite module not found',
        stack: [],
        constraints: [],
        providers: ['github', 'npm'],
        mode: 'real',
        maxResults: 5,
      },
      now: new Date('2026-07-10T00:00:00Z'),
      searchers: {
        github: async () => {
          throw new Error('rate limited');
        },
        npm: async () => [npmCandidate],
        web: async () => [],
      },
    });

    expect(result.providerStatus).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'github', state: 'failed' }),
      expect.objectContaining({ provider: 'npm', state: 'complete', resultCount: 1 }),
    ]));
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.name).toBe('vite-helper');
  });
});
