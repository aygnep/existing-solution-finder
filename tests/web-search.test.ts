import { searchWeb } from '../src/providers/web-search';
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

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('searchWeb', () => {
  it('supports SerpApi organic results', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({
      organic_results: [
        { title: 'Fix guide', link: 'https://example.com/fix', snippet: 'A useful fix.' },
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
    })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl] = (fetchMock as jest.Mock).mock.calls[0] as [string];
    expect(requestUrl).toContain('https://serpapi.com/search.json');
    expect(requestUrl).toContain('engine=google');
    expect(requestUrl).toContain('api_key=serp_test_key');
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
});
