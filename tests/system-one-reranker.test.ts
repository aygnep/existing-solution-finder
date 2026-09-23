import { createJevReranker, createLayaReranker } from '../src/providers/system-one-reranker';
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

describe('Laya local reranker adapter', () => {
  it('uses the loopback Jev-compatible API without an external key', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.endsWith('/health')) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      return new Response(JSON.stringify({
        model: 'laya-rl-agent', routing: { model: 'multilingual' },
        answers: {
          relevant: { type: 'noul', noul: 0.61 },
          compatible: { type: 'noul', noul: 0.77 },
          evidence: { type: 'noul', noul: 0.58 },
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;
    const reranker = createLayaReranker({ ...env, TYPESAFE_API_KEY: undefined, LAYA_PORT: 8766 }, { fetchImpl });
    const result = await reranker.evaluate({
      problem: '中文问题'.repeat(300), stack: ['Vite'], constraints: [],
      candidates: [{ ...candidate, evidence: [{ ...candidate.evidence[0]!, excerpt: '证据'.repeat(400) }] }],
    });

    expect(result.model).toBe('laya/multilingual');
    expect(result.judgments[0]).toMatchObject({ relevanceProbability: 0.61, compatibilityProbability: 0.77 });
    const calls = (fetchImpl as jest.Mock).mock.calls as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:8766/health',
      'http://127.0.0.1:8766/v1/systemone',
    ]);
    const request = calls[1]![1];
    expect(request.headers).not.toHaveProperty('Authorization');
    const body = JSON.parse(String(request.body));
    expect(body).not.toHaveProperty('model');
    expect(body.state.problem.length).toBeLessThanOrEqual(500);
    expect(body.state.candidate.evidence[0].excerpt.length).toBeLessThanOrEqual(250);
  });

  it('fails before sending candidates when the local service is unavailable', async () => {
    const fetchImpl = jest.fn(async () => { throw new Error('connection refused'); }) as unknown as typeof fetch;
    const reranker = createLayaReranker(env, { fetchImpl });

    await expect(reranker.evaluate({ problem: 'module error', stack: [], constraints: [], candidates: [candidate] }))
      .rejects.toThrow('Laya local server is unavailable.');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
