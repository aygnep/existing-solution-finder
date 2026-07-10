import type { DiscoverySearchers } from '../core/discovery-service.js';
import type { DiscoveryMode } from '../types/discovery.js';
import type { Provider, Query, RawCandidate } from '../types/candidate.js';
import { loadEnv } from '../utils/env.js';
import { createMockProvider, getBuiltinMockCandidates } from './mock-provider.js';
import { searchGitHubMultiQuery } from './github-search.js';
import { searchPackages } from './package-search.js';
import { searchWeb } from './web-search.js';

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
      ? searchGitHubMultiQuery(queries, env)
      : { raw: [], state: 'skipped', message: 'GitHub token is not configured.' },
    web: async (queries) => env.WEB_SEARCH_API_KEY
      ? (await Promise.all(queries.map((query) => searchWeb(query, env)))).flat()
      : { raw: [], state: 'skipped', message: 'Web search key is not configured.' },
    npm: async (queries) => (await Promise.all(queries.map((query) => searchPackages(query, env)))).flat(),
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
