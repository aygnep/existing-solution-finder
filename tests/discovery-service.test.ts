import { discoverSolutions } from '../src/core/discovery-service';
import type { RawCandidate } from '../src/types/candidate';

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
