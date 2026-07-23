import {
  fetchProviderJson,
  mapWithConcurrency,
  providerCacheKey,
  resetProviderRuntimeForTests,
  setProviderRuntimeHooksForTests,
} from '../src/providers/provider-runtime';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  resetProviderRuntimeForTests();
});

describe('provider runtime', () => {
  it('retries retryable failures, honors capped Retry-After, and then succeeds', async () => {
    const delays: number[] = [];
    setProviderRuntimeHooksForTests({
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response('busy', {
        status: 429,
        headers: { 'Retry-After': '60' },
      }))
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;

    const result = await fetchProviderJson<{ ok: boolean }>({
      provider: 'web',
      operation: 'test search',
      url: 'https://example.test/search',
      timeoutMs: 1000,
      maxRetryDelayMs: 250,
    });

    expect(result).toEqual({ ok: true });
    expect(delays).toEqual([250, 200]);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('caches successful query responses and coalesces in-flight requests', async () => {
    setProviderRuntimeHooksForTests({
      now: () => 1_000,
      sleep: async () => undefined,
    });
    let resolveFetch: ((response: Response) => void) | undefined;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    })) as unknown as typeof fetch;
    const options = {
      provider: 'npm' as const,
      operation: 'test search',
      url: 'https://example.test/search',
      timeoutMs: 1000,
      cacheKey: providerCacheKey('npm', 'search', 'secret-shaped-query', 5),
    };

    const first = fetchProviderJson<{ value: number }>(options);
    const second = fetchProviderJson<{ value: number }>(options);
    resolveFetch?.(new Response(JSON.stringify({ value: 1 }), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: 1 },
      { value: 1 },
    ]);
    await expect(fetchProviderJson<{ value: number }>(options)).resolves.toEqual({ value: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(options.cacheKey).not.toContain('secret-shaped-query');
  });

  it('classifies timeout failures without leaking native error text', async () => {
    setProviderRuntimeHooksForTests({ sleep: async () => undefined });
    const timeout = new Error('request URL included api_key=secret');
    timeout.name = 'TimeoutError';
    global.fetch = jest.fn(async () => {
      throw timeout;
    }) as unknown as typeof fetch;

    await expect(fetchProviderJson({
      provider: 'web',
      operation: 'timeout test',
      url: 'https://example.test',
      timeoutMs: 1,
      maxAttempts: 1,
    })).rejects.toMatchObject({
      provider: 'web',
      kind: 'timeout',
      retryable: true,
      message: '[web] provider request failed (kind=timeout, retryable=true)',
    });
  });

  it('caps concurrent provider work while preserving result order', async () => {
    let active = 0;
    let maxActive = 0;
    const gates: Array<() => void> = [];

    const pending = mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => {
        gates.push(resolve);
      });
      active -= 1;
      return value * 2;
    });

    await Promise.resolve();
    expect(active).toBe(2);
    while (gates.length > 0 || active > 0) {
      gates.shift()?.();
      await Promise.resolve();
    }

    await expect(pending).resolves.toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBe(2);
  });
});
