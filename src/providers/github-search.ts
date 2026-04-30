import type { Env } from '../utils/env.js';
import type { Query, RawCandidate } from '../types/candidate.js';
import { logger } from '../utils/logger.js';

interface GitHubRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  license: { spdx_id: string } | null;
  pushed_at: string;
  created_at: string;
  archived: boolean;
  open_issues_count: number;
  owner: { type: 'User' | 'Organization' };
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubRepo[];
}

/**
 * Searches GitHub repositories for candidates matching the query.
 *
 * Uses the GitHub Search API (repositories endpoint).
 * Requires GITHUB_TOKEN in env.
 */
export async function searchGitHub(
  query: Query,
  env: Env,
): Promise<readonly RawCandidate[]> {
  const url = buildUrl(query.text, env.MAX_RESULTS_PER_PROVIDER);

  logger.debug('GitHub search', { url: url.toString().replace(env.GITHUB_TOKEN, '[REDACTED]') });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(env.REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn('GitHub search request failed', { error: String(err) });
    return [];
  }

  if (!response.ok) {
    logger.warn('GitHub search returned non-OK status', {
      status: response.status,
      query: query.text,
    });
    return [];
  }

  let data: GitHubSearchResponse;
  try {
    data = (await response.json()) as GitHubSearchResponse;
  } catch {
    logger.warn('GitHub search response parse failed');
    return [];
  }

  return data.items.map((repo) => mapRepo(repo, query));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUrl(queryText: string, perPage: number): URL {
  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', queryText);
  url.searchParams.set('sort', 'stars');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(Math.min(perPage, 30)));
  return url;
}

function mapRepo(repo: GitHubRepo, _query: Query): RawCandidate {
  return {
    id: repo.html_url,
    name: repo.full_name,
    url: repo.html_url,
    description: repo.description ?? '',
    provider: 'github',
    metadata: {
      stars: repo.stargazers_count,
      license: repo.license?.spdx_id ?? undefined,
      lastCommitDate: repo.pushed_at ? new Date(repo.pushed_at) : undefined,
      createdDate: repo.created_at ? new Date(repo.created_at) : undefined,
      isArchived: repo.archived,
      openIssueCount: repo.open_issues_count,
      ownerType: repo.owner.type === 'Organization' ? 'organization' : 'user',
    },
  };
}
