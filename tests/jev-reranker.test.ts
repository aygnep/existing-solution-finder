import { createJevReranker } from '../src/providers/jev-reranker';
import type { SolutionCandidate } from '../src/types/discovery';
import type { Env } from '../src/utils/env';

const env: Env = {
  GITHUB_TOKEN: undefined,
  WEB_SEARCH_PROVIDER: undefined,
  WEB_SEARCH_API_KEY: undefined,
  TYPESAFE_API_KEY: 'test-key-do-not-log',
  JEV_MODEL: 'jev-1.13.0',
  LOG_LEVEL: 'warn',
  MAX_RESULTS_PER_PROVIDER: 10,
  REQUEST_TIMEOUT_MS: 1000,
};

const candidate = {
  id: 'https://github.com/example/fix',
  solutionKey: 'https://github.com/example/fix',
  name: 'example/fix',
  url: 'https://github.com/example/fix',
  description: 'Fixes module resolution',
  provider: 'github',
  metadata: {},
  rank: 1,
  candidateType: 'tool',
  matchReason: 'Related error',
  nextStep: 'Review source',
  score: {
    breakdown: { exactErrorMatch: 0, stackMatch: 0, readmeEvidence: 0, recency: 0, installationClarity: 0, maintenanceActivity: 0, exampleConfig: 0 },
    penalties: [], subtotal: 0, total: 0, displayTotal: 0, trustLevel: 'LOW', warnings: [],
  },
  evidence: [{ sourceUrl: 'https://github.com/example/fix', sourceKind: 'github', title: 'Fix', excerpt: 'Relevant fix', retrievedAt: '2026-09-23T00:00:00.000Z' }],
  relatedCandidates: [],
  validationSteps: [],
} satisfies SolutionCandidate;

describe('Jev reranker adapter', () => {
  it('stays unavailable without a configured API key', () => {
    expect(createJevReranker({ ...env, TYPESAFE_API_KEY: undefined })).toBeUndefined();
  });

  it('sends bounded, redacted candidate evidence and reads Noul probabilities', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      model: 'jev-1.13.0',
      answers: {
        relevant: { type: 'noul', noul: 0.82 },
        compatible: { type: 'noul', noul: 0.91 },
        evidence: { type: 'noul', noul: 0.73 },
      },
    }), { status: 200 })) as unknown as typeof fetch;
    const reranker = createJevReranker(env, { fetchImpl })!;
    const result = await reranker.evaluate({
      problem: 'token=github_pat_supersecret123456789 module not found',
      stack: ['Vite'],
      constraints: ['no upgrade'],
      candidates: [{ ...candidate, evidence: [{ ...candidate.evidence[0]!, excerpt: 'A'.repeat(1_500) }] }],
    });

    expect(result.judgments).toEqual([{
      solutionKey: candidate.solutionKey,
      relevanceProbability: 0.82,
      compatibilityProbability: 0.91,
      evidenceProbability: 0.73,
      model: 'jev-1.13.0',
    }]);
    const [url, request] = (fetchImpl as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer test-key-do-not-log' });
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe('jev-1.13.0');
    expect(JSON.stringify(body)).not.toContain('supersecret');
    expect(JSON.stringify(body)).not.toContain('test-key-do-not-log');
    expect(body.state.candidate.evidence[0].excerpt).toHaveLength(900);
    expect(body.questions.relevant.type).toBe('noul');
    expect(body.questions.compatible.type).toBe('noul');
  });

  it('fails closed on invalid API responses without copying response text', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      error: 'secret provider body',
    }), { status: 200 })) as unknown as typeof fetch;
    const reranker = createJevReranker(env, { fetchImpl })!;

    await expect(reranker.evaluate({ problem: 'module error', stack: [], constraints: [], candidates: [candidate] }))
      .rejects.toThrow('Jev returned an invalid response.');
  });

  it('classifies authentication failure without exposing the response body', async () => {
    const fetchImpl = jest.fn(async () => new Response('private authentication details', { status: 401 })) as unknown as typeof fetch;
    const reranker = createJevReranker(env, { fetchImpl })!;

    await expect(reranker.evaluate({ problem: 'module error', stack: [], constraints: [], candidates: [candidate] }))
      .rejects.toThrow('Jev authentication failed.');
  });
});
