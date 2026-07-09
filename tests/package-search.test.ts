import { searchPackages } from '../src/providers/package-search';
import type { Env } from '../src/utils/env';

const env: Env = {
  LOG_LEVEL: 'warn',
  MAX_RESULTS_PER_PROVIDER: 10,
  REQUEST_TIMEOUT_MS: 1000,
};

describe('searchPackages', () => {
  it('preserves a package repository URL as canonical provenance', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      total: 1,
      objects: [{
        package: {
          name: 'vite-helper',
          description: 'Vite helper',
          version: '1.0.0',
          links: {
            npm: 'https://www.npmjs.com/package/vite-helper',
            repository: 'https://github.com/example/vite-helper',
          },
          date: '2026-07-01T00:00:00Z',
        },
        score: { final: 0.9 },
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    const results = await searchPackages({
      text: 'vite helper',
      category: 'alternatives',
      providers: ['npm'],
    }, env);

    expect(results[0]!.metadata.repositoryUrl).toBe('https://github.com/example/vite-helper');
  });
});
