import { searchWeb } from '../src/providers/web-search';
import {
  resetProviderRuntimeForTests,
  setProviderRuntimeHooksForTests,
} from '../src/providers/provider-runtime';
import type { Env } from '../src/utils/env';

const originalFetch = global.fetch;

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    WEB_SEARCH_PROVIDER: 'serpapi',
    WEB_SEARCH_API_KEY: 'serp_test_key',
    LOG_LEVEL: 'warn',
    MAX_RESULTS_PER_PROVIDER: 5,
    REQUEST_TIMEOUT_MS: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  setProviderRuntimeHooksForTests({ sleep: async () => undefined });
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  resetProviderRuntimeForTests();
});

describe('searchWeb', () => {
  it('preserves SerpApi organic-result evidence without inventing trust data', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({
      organic_results: [
        {
          title: 'Fix guide',
          link: 'https://example.com/fix',
          snippet: 'A useful fix.',
          date: '2026-07-20',
          source: 'Example Docs',
        },
        { title: 'Missing link' },
      ],
    }), { status: 200 })) as unknown as typeof fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await searchWeb({
      text: 'vite module not found',
      category: 'exact-error',
      providers: ['web'],
    }, makeEnv());

    expect(results).toEqual([expect.objectContaining({
      id: 'https://example.com/fix',
      name: 'Fix guide',
      url: 'https://example.com/fix',
      description: 'A useful fix.',
      provider: 'web',
      providerEvidence: {
        sourceUrl: 'https://example.com/fix',
        title: 'Fix guide',
        snippet: 'A useful fix.',
        publishedDate: '2026-07-20',
        sourceName: 'Example Docs',
      },
    })]);
    expect(results[0]!.metadata).toEqual({
      createdDate: new Date('2026-07-20'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl] = (fetchMock as jest.Mock).mock.calls[0] as [string];
    expect(requestUrl).toContain('https://serpapi.com/search.json');
    expect(requestUrl).toContain('engine=google');
    expect(requestUrl).toContain('api_key=serp_test_key');
  });

  it('preserves Brave source and date evidence', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      web: {
        results: [{
          title: 'Brave result',
          url: 'https://docs.example.com/fix',
          description: 'Documented workaround.',
          page_age: '2026-07-19T10:00:00Z',
        }],
      },
    }), { status: 200 })) as unknown as typeof fetch;

    const results = await searchWeb({
      text: 'documented workaround',
      category: 'exact-error',
      providers: ['web'],
    }, makeEnv({
      WEB_SEARCH_PROVIDER: 'brave',
      WEB_SEARCH_API_KEY: 'brave_secret',
    }));

    expect(results[0]).toMatchObject({
      providerEvidence: {
        sourceUrl: 'https://docs.example.com/fix',
        title: 'Brave result',
        snippet: 'Documented workaround.',
        publishedDate: '2026-07-19T10:00:00Z',
      },
      metadata: {
        createdDate: new Date('2026-07-19T10:00:00Z'),
      },
    });
    expect((results[0] as unknown as { trust?: unknown }).trust).toBeUndefined();
  });

  it('returns no results when the web key is not configured', async () => {
    const fetchMock = jest.fn() as unknown as typeof fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await searchWeb({
      text: 'vite module not found',
      category: 'exact-error',
      providers: ['web'],
    }, makeEnv({ WEB_SEARCH_API_KEY: undefined }));

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a successful zero-result response empty', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ organic_results: [] }), { status: 200 }),
    ) as unknown as typeof fetch;

    const results = await searchWeb({
      text: 'no matching result',
      category: 'exact-error',
      providers: ['web'],
    }, makeEnv());

    expect(results).toEqual([]);
  });

  it('propagates bad credentials without exposing the API key', async () => {
    const apiKey = 'serp_very_secret_key';
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: `Invalid API key ${apiKey}` }), { status: 200 }),
    ) as unknown as typeof fetch;

    let thrown: unknown;
    try {
      await searchWeb({
        text: apiKey,
        category: 'exact-error',
        providers: ['web'],
      }, makeEnv({ WEB_SEARCH_API_KEY: apiKey }));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      provider: 'web',
      kind: 'auth',
      retryable: false,
    });
    expect(String(thrown)).not.toContain(apiKey);
  });

  it('propagates invalid JSON as a provider failure', async () => {
    global.fetch = jest.fn(async () =>
      new Response('{bad-json', { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(searchWeb({
      text: 'vite',
      category: 'exact-error',
      providers: ['web'],
    }, makeEnv())).rejects.toMatchObject({
      provider: 'web',
      kind: 'invalid-json',
      status: 200,
      retryable: false,
    });
  });
});
