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
