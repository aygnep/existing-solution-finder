import type { DiscoverySearchers, ProviderSearchResult } from '../core/discovery-service.js';
import type { DiscoveryMode } from '../types/discovery.js';
import type { Provider, Query, RawCandidate } from '../types/candidate.js';
import { loadEnv } from '../utils/env.js';
import { createMockProvider, getBuiltinMockCandidates } from './mock-provider.js';
import { searchGitHub, searchGitHubIssues } from './github-search.js';
import { searchPackages } from './package-search.js';
import { searchWeb } from './web-search.js';
import { mapWithConcurrency, ProviderError } from './provider-runtime.js';

const QUERY_CONCURRENCY = 3;

export async function createDiscoverySearchers(mode: DiscoveryMode): Promise<DiscoverySearchers> {
  return mode === 'mock' ? createMockSearchers() : createRealSearchers();
}

function createMockSearchers(): DiscoverySearchers {
  const mockSearch = createMockProvider(getBuiltinMockCandidates());
  return createSearchersFromQueryFunction((provider, queries) =>
    Promise.all(queries.map((query) => mockSearch(query))).then((results) =>
      results.flat().filter((candidate) => candidate.provider === provider),
    ),
  );
}

function createRealSearchers(): DiscoverySearchers {
  const env = loadEnv();
  return {
    github: async (queries) => env.GITHUB_TOKEN
      ? runQueryBatch(queries, (query) => query.category === 'github-issues'
        ? searchGitHubIssues(query, env)
        : searchGitHub(query, env))
      : { raw: [], state: 'skipped', message: 'GitHub token is not configured.' },
    web: async (queries) => env.WEB_SEARCH_API_KEY
      ? runQueryBatch(queries, (query) => searchWeb(query, env))
      : { raw: [], state: 'skipped', message: 'Web search key is not configured.' },
    npm: async (queries) => runQueryBatch(queries, (query) => searchPackages(query, env)),
  };
}

export async function runQueryBatch(
  queries: readonly Query[],
  search: (query: Query) => Promise<readonly RawCandidate[]>,
): Promise<ProviderSearchResult> {
  const settled = await mapWithConcurrency(queries, QUERY_CONCURRENCY, async (query): Promise<
    { ok: true; raw: readonly RawCandidate[] } | { ok: false; error: unknown }
  > => {
    try {
      return { ok: true, raw: await search(query) };
    } catch (error) {
      return { ok: false, error };
    }
  });
  const failures = settled.filter((item): item is { ok: false; error: unknown } => !item.ok);
  if (failures.length === queries.length && failures.length > 0) throw failures[0]!.error;

  const raw = [...new Map(settled.flatMap((item) => item.ok ? item.raw : [])
    .map((candidate) => [candidate.id.toLowerCase(), candidate] as const)).values()];
  if (failures.length === 0) return raw;

  const kinds = [...new Set(failures.map(({ error }) => error instanceof ProviderError ? error.kind : 'unknown'))];
  return {
    raw,
    state: 'partial',
    message: `${failures.length} of ${queries.length} queries failed (${kinds.join(', ')}); successful results were retained.`,
  };
}

function createSearchersFromQueryFunction(
  search: (provider: Provider, queries: readonly Query[]) => Promise<readonly RawCandidate[]>,
): DiscoverySearchers {
  return {
    github: (queries) => search('github', queries),
    web: (queries) => search('web', queries),
    npm: (queries) => search('npm', queries),
  };
}
