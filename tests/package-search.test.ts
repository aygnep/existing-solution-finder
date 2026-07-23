import { searchPackages } from '../src/providers/package-search';
import {
  resetProviderRuntimeForTests,
  setProviderRuntimeHooksForTests,
} from '../src/providers/provider-runtime';
import type { Env } from '../src/utils/env';

const originalFetch = global.fetch;

const env: Env = {
  LOG_LEVEL: 'warn',
  MAX_RESULTS_PER_PROVIDER: 10,
  REQUEST_TIMEOUT_MS: 1000,
};

function searchResponse(packages: unknown[]): Response {
  return new Response(JSON.stringify({
    total: packages.length,
    objects: packages,
  }), { status: 200 });
}

function searchPackage(name = 'vite-helper') {
  return {
    package: {
      name,
      description: 'Vite helper',
      version: '1.0.0',
      links: {
        npm: `https://www.npmjs.com/package/${name}`,
        repository: `git+https://github.com/example/${name}.git`,
      },
      date: '2026-07-01T00:00:00Z',
    },
    score: { final: 0.9 },
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

describe('searchPackages', () => {
  it('enriches a bounded result with npm registry evidence', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(searchResponse([searchPackage()]))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        name: 'vite-helper',
        readme: '# Vite Helper\n\nnpm install vite-helper\n\nUsage example.',
        license: 'MIT',
        repository: { url: 'git+https://github.com/example/vite-helper.git' },
        'dist-tags': { latest: '2.1.0' },
        versions: {
          '2.1.0': {
            version: '2.1.0',
            description: 'Latest Vite helper',
            license: 'MIT',
          },
        },
        time: {
          '2.1.0': '2026-07-20T00:00:00Z',
          modified: '2026-07-21T00:00:00Z',
        },
      }), { status: 200 })) as unknown as typeof fetch;

    const results = await searchPackages({
      text: 'vite helper',
      category: 'alternatives',
      providers: ['npm'],
    }, env);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      description: 'Latest Vite helper',
      readmeSnippet: expect.stringContaining('npm install vite-helper'),
      metadata: {
        repositoryUrl: 'https://github.com/example/vite-helper',
        license: 'MIT',
        hasInstallInstructions: true,
      },
      providerEvidence: {
        registryUrl: 'https://registry.npmjs.org/vite-helper',
        latestVersion: '2.1.0',
        updatedAt: '2026-07-20T00:00:00Z',
        metadataStatus: 'complete',
      },
    });
    expect(results[0]!.metadata.lastCommitDate).toEqual(
      new Date('2026-07-20T00:00:00Z'),
    );
  });

  it('degrades one package when its metadata fetch fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(searchResponse([searchPackage()]))
      .mockResolvedValue(new Response('upstream unavailable', { status: 503 })) as unknown as typeof fetch;

    const results = await searchPackages({
      text: 'vite helper',
      category: 'alternatives',
      providers: ['npm'],
    }, env);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: 'vite-helper',
      description: 'Vite helper',
      metadata: {
        repositoryUrl: 'https://github.com/example/vite-helper',
        hasInstallInstructions: true,
      },
      providerEvidence: {
        latestVersion: '1.0.0',
        metadataStatus: 'degraded',
      },
    });
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it('propagates primary search failures instead of returning empty', async () => {
    global.fetch = jest.fn(async () =>
      new Response('rate limited', { status: 429 }),
    ) as unknown as typeof fetch;

    await expect(searchPackages({
      text: 'vite helper',
      category: 'alternatives',
      providers: ['npm'],
    }, env)).rejects.toMatchObject({
      provider: 'npm',
      kind: 'rate-limit',
      status: 429,
      retryable: true,
    });
  });

  it('keeps a successful zero-result response empty', async () => {
    global.fetch = jest.fn(async () => searchResponse([])) as unknown as typeof fetch;

    const results = await searchPackages({
      text: 'definitely-no-package',
      category: 'alternatives',
      providers: ['npm'],
    }, env);

    expect(results).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not enrich beyond MAX_RESULTS_PER_PROVIDER', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(searchResponse([
        searchPackage('first-package'),
        searchPackage('second-package'),
      ]))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        'dist-tags': { latest: '1.0.0' },
      }), { status: 200 })) as unknown as typeof fetch;

    const results = await searchPackages({
      text: 'packages',
      category: 'alternatives',
      providers: ['npm'],
    }, { ...env, MAX_RESULTS_PER_PROVIDER: 1 });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('first-package');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
