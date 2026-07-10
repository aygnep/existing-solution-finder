import { createGateway } from '../src/web/gateway';
import type { DiscoveryResult } from '../src/types/discovery';

const fixtureResult = {
  request: {
    problem: 'Vite cannot find a module', stack: [], constraints: [],
    providers: ['npm'], mode: 'mock', maxResults: 5,
  },
  parsedProblem: { raw: 'Vite cannot find a module', errorTokens: [], stackNames: ['Vite'], versions: [], constraints: [], keywords: ['vite'] },
  searchPlan: [],
  providerStatus: [{ provider: 'npm', state: 'empty', resultCount: 0 }],
  candidates: [],
  completedAt: '2026-07-10T00:00:00.000Z',
} satisfies DiscoveryResult;

const fixtureRequest = {
  problem: 'Vite cannot find a module',
  stack: [], constraints: [], providers: ['npm'], mode: 'mock', maxResults: 5,
};

describe('web gateway', () => {
  it('uses deterministic mock candidates for mock-mode requests', async () => {
    const app = createGateway();
    const response = await app.inject({
      method: 'POST',
      url: '/api/discover',
      payload: { ...fixtureRequest, problem: 'reasoning_content error with Claude Code', providers: ['github'], mode: 'mock' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().candidates.map((candidate: { name: string }) => candidate.name)).toContain('oc-go-cc');
    await app.close();
  });

  it('returns a structured result for a valid discovery request', async () => {
    const app = createGateway({ discover: async () => fixtureResult });
    const response = await app.inject({ method: 'POST', url: '/api/discover', payload: fixtureRequest });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(fixtureResult);
    await app.close();
  });

  it('never returns a token from a provider error', async () => {
    const app = createGateway({
      discover: async () => {
        throw new Error('GITHUB_TOKEN=secret');
      },
    });
    const response = await app.inject({ method: 'POST', url: '/api/discover', payload: fixtureRequest });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret');
    await app.close();
  });
});
