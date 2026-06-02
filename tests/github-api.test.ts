import {
  classifyGitHubStatus,
  fetchGitHubJson,
  type GitHubApiFailureKind,
} from '../src/providers/github-api';
import type { Env } from '../src/utils/env';

const originalFetch = global.fetch;

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    GITHUB_TOKEN: 'ghp_test_token',
    LOG_LEVEL: 'warn',
    MAX_RESULTS_PER_PROVIDER: 10,
    REQUEST_TIMEOUT_MS: 1000,
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('classifyGitHubStatus', () => {
  it.each<[number, GitHubApiFailureKind]>([
    [401, 'auth'],
    [403, 'rate-limit'],
    [404, 'not-found'],
    [422, 'other'],
    [429, 'rate-limit'],
    [500, 'other'],
  ])('classifies %i as %s', (status, expected) => {
    expect(classifyGitHubStatus(status)).toBe(expected);
  });
});

describe('fetchGitHubJson', () => {
  it('sends GitHub auth and API version headers', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ ok: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchGitHubJson<{ ok: boolean }>(
      new URL('https://api.github.com/search/repositories?q=test'),
      makeEnv(),
      { requestName: 'repo search', query: 'test' },
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(callArgs[1]).toMatchObject({
      headers: {
        Authorization: 'Bearer ghp_test_token',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  });

  it('returns an auth failure for 401 responses', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Bad credentials' }, { status: 401 }),
    ) as unknown as typeof fetch;

    const result = await fetchGitHubJson<{ ok: boolean }>(
      new URL('https://api.github.com/search/repositories?q=test'),
      makeEnv(),
      { requestName: 'repo search', query: 'test' },
    );

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: 'auth',
        status: 401,
        message: 'repo search returned HTTP 401 for query "test"',
      },
    });
  });

  it('returns a rate-limit failure for 403 responses', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'API rate limit exceeded' }, { status: 403 }),
    ) as unknown as typeof fetch;

    const result = await fetchGitHubJson<{ ok: boolean }>(
      new URL('https://api.github.com/search/issues?q=test'),
      makeEnv(),
      { requestName: 'issue search', query: 'test' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.kind).toBe('rate-limit');
      expect(result.failure.status).toBe(403);
    }
  });

  it('returns a not-found failure for 404 responses', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Not Found' }, { status: 404 }),
    ) as unknown as typeof fetch;

    const result = await fetchGitHubJson<{ ok: boolean }>(
      new URL('https://api.github.com/repos/owner/repo'),
      makeEnv(),
      { requestName: 'repo fetch', query: 'owner/repo' },
    );

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: 'not-found',
        status: 404,
        message: 'repo fetch returned HTTP 404 for query "owner/repo"',
      },
    });
  });

  it('returns an invalid-json failure when response JSON cannot be parsed', async () => {
    global.fetch = jest.fn(async () =>
      new Response('{not-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const result = await fetchGitHubJson<{ ok: boolean }>(
      new URL('https://api.github.com/search/repositories?q=test'),
      makeEnv(),
      { requestName: 'repo search', query: 'test' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.kind).toBe('invalid-json');
      expect(result.failure.message).toBe('repo search returned invalid JSON for query "test"');
    }
  });

  it('returns a network failure when fetch throws', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('socket closed');
    }) as unknown as typeof fetch;

    const result = await fetchGitHubJson<{ ok: boolean }>(
      new URL('https://api.github.com/search/repositories?q=test'),
      makeEnv(),
      { requestName: 'repo search', query: 'test' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.kind).toBe('network');
      expect(result.failure.message).toBe('repo search request failed for query "test": Error: socket closed');
    }
  });
});
