import type { Env } from '../utils/env.js';
import type { Query, RawCandidate } from '../types/candidate.js';
import { logger } from '../utils/logger.js';
import { fetchGitHubJson, gitHubFailureAsError } from './github-api.js';
import {
  ProviderError,
  fetchProviderText,
  invalidateProviderCache,
  mapWithConcurrency,
  providerCacheKey,
} from './provider-runtime.js';

/** Maximum length for a GitHub search query to avoid API errors */
const MAX_QUERY_LENGTH = 256;

/** Maximum README bytes to fetch */
const MAX_README_BYTES = 8192;
const QUERY_CONCURRENCY = 3;
const README_CONCURRENCY = 3;

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
  default_branch: string;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubRepo[];
}

interface GitHubIssue {
  html_url: string;
  title: string;
  body: string | null;
  number: number;
  state: 'open' | 'closed';
  repository_url: string;
  created_at: string;
  updated_at: string;
  user: { type: 'User' | 'Organization' };
}

interface GitHubIssueSearchResponse {
  total_count: number;
  items: GitHubIssue[];
}

/**
 * Searches GitHub repositories for candidates matching the query.
 *
 * Uses the GitHub Search API (repositories endpoint).
 * Fetches README for each repo and extracts metadata.
 * Requires GITHUB_TOKEN in env.
 */
export async function searchGitHub(
  query: Query,
  env: Env,
): Promise<readonly RawCandidate[]> {
  if (!env.GITHUB_TOKEN) {
    logger.warn('GitHub search skipped: GITHUB_TOKEN not configured');
    return [];
  }

  const sanitizedQuery = sanitizeGitHubQuery(query.text);
  if (!sanitizedQuery) {
    logger.debug('GitHub search skipped: empty query after sanitization');
    return [];
  }

  const url = buildUrl(sanitizedQuery, env.MAX_RESULTS_PER_PROVIDER);

  logger.debug('GitHub repository search started');

  const cacheKey = providerCacheKey(
    'github',
    'GitHub repository search',
    sanitizedQuery,
    env.MAX_RESULTS_PER_PROVIDER,
  );
  const result = await fetchGitHubJson<GitHubSearchResponse>(
    url,
    env,
    { requestName: 'GitHub repository search', query: sanitizedQuery },
  );

  if (!result.ok) throw gitHubFailureAsError(result.failure);

  const data = result.data;
  if (!Array.isArray(data.items)) {
    invalidateProviderCache(cacheKey);
    throw new ProviderError({
      provider: 'github',
      operation: 'GitHub repository search',
      kind: 'invalid-json',
      retryable: false,
    });
  }

  const candidates = await mapWithConcurrency(
    data.items,
    README_CONCURRENCY,
    (repo) => mapRepoWithReadme(repo, env),
  );

  return candidates;
}

export async function searchGitHubIssues(
  query: Query,
  env: Env,
): Promise<readonly RawCandidate[]> {
  if (!env.GITHUB_TOKEN) {
    logger.warn('GitHub issue search skipped: GITHUB_TOKEN not configured');
    return [];
  }

  const sanitizedQuery = sanitizeGitHubQuery(query.text);
  if (!sanitizedQuery) {
    logger.debug('GitHub issue search skipped: empty query after sanitization');
    return [];
  }

  const url = buildIssueSearchUrl(sanitizedQuery, env.MAX_RESULTS_PER_PROVIDER);
  const cacheKey = providerCacheKey(
    'github',
    'GitHub issue search',
    sanitizedQuery,
    env.MAX_RESULTS_PER_PROVIDER,
  );
  const result = await fetchGitHubJson<GitHubIssueSearchResponse>(
    url,
    env,
    { requestName: 'GitHub issue search', query: sanitizedQuery },
  );

  if (!result.ok) throw gitHubFailureAsError(result.failure);
  if (!Array.isArray(result.data.items)) {
    invalidateProviderCache(cacheKey);
    throw new ProviderError({
      provider: 'github',
      operation: 'GitHub issue search',
      kind: 'invalid-json',
      retryable: false,
    });
  }

  return result.data.items.map(mapIssue);
}

/**
 * Searches GitHub across multiple queries and deduplicates results by ID.
 * Routes repo queries to repositories and issue queries to issues.
 */
export async function searchGitHubMultiQuery(
  queries: readonly Query[],
  env: Env,
): Promise<readonly RawCandidate[]> {
  const repoQueries = queries.filter((q) => q.category !== 'github-issues');
  const issueQueries = queries.filter((q) => q.category === 'github-issues');

  const routedQueries = [
    ...repoQueries.map((query) => ({ query, kind: 'repo' as const })),
    ...issueQueries.map((query) => ({ query, kind: 'issue' as const })),
  ];
  const results = await mapWithConcurrency(
    routedQueries,
    QUERY_CONCURRENCY,
    ({ query, kind }) => kind === 'repo'
      ? searchGitHub(query, env)
      : searchGitHubIssues(query, env),
  );

  return deduplicateById(results.flat());
}

// ─── Query sanitization ───────────────────────────────────────────────────────

/**
 * Sanitizes a query string for the GitHub Search API.
 *
 * - Removes `site:github.com` (redundant for GitHub API)
 * - Strips overly long error log snippets
 * - Preserves quoted phrases and key stack names
 * - Truncates to MAX_QUERY_LENGTH
 */
export function sanitizeGitHubQuery(queryText: string): string {
  let sanitized = queryText;

  // Remove site:github.com and similar site: prefixes
  sanitized = sanitized.replace(/\bsite:\S+/gi, '');

  // Remove very long unquoted tokens (likely error logs / stack traces)
  sanitized = sanitized.replace(/\b\S{100,}\b/g, '');

  // Collapse multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncate to max length, trying to break at a word boundary
  if (sanitized.length > MAX_QUERY_LENGTH) {
    const truncated = sanitized.slice(0, MAX_QUERY_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');
    sanitized = lastSpace > MAX_QUERY_LENGTH / 2
      ? truncated.slice(0, lastSpace)
      : truncated;
  }

  return sanitized.trim();
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Deduplicates candidates by full_name (case-insensitive).
 * When duplicates are found, keeps the first occurrence.
 *
 * Note: kept as exported public API for backward compatibility.
 * Internally, searchGitHubMultiQuery now uses deduplicateById instead.
 */
export function deduplicateByFullName(
  candidates: readonly RawCandidate[],
): readonly RawCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── README extraction ────────────────────────────────────────────────────────

interface ReadmeMetadata {
  hasInstallInstructions: boolean;
  hasExampleConfig: boolean;
  hasSuspiciousInstallScript: boolean;
}

/**
 * Extracts metadata flags from README content.
 */
export function extractReadmeMetadata(readme: string): ReadmeMetadata {
  const lower = readme.toLowerCase();

  const hasInstallInstructions =
    /\b(npm install|pip install|go install|brew install|cargo install|yarn add|pnpm add|gem install|composer require)\b/.test(lower);

  const hasExampleConfig =
    /\b(example|config|configuration)\b/.test(lower) &&
    /```/.test(readme);

  const hasSuspiciousInstallScript =
    /\b(curl\s+\S+|wget\s+\S+)\s*\|/.test(lower) &&
    !/\b(sha256sum|sha1sum|md5sum|checksum|gpg --verify)\b/.test(lower);

  return { hasInstallInstructions, hasExampleConfig, hasSuspiciousInstallScript };
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

function buildIssueSearchUrl(queryText: string, perPage: number): URL {
  const url = new URL('https://api.github.com/search/issues');
  const issueQuery = queryText.includes('is:issue')
    ? queryText
    : `${queryText} is:issue`;
  url.searchParams.set('q', issueQuery);
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(Math.min(perPage, 30)));
  return url;
}

function mapIssue(issue: GitHubIssue): RawCandidate {
  const repoName = repoNameFromApiUrl(issue.repository_url);
  const body = issue.body ?? '';

  return {
    id: issue.html_url,
    name: `${repoName}#${issue.number}`,
    url: issue.html_url,
    description: issue.title,
    readmeSnippet: body ? body.slice(0, MAX_README_BYTES) : undefined,
    provider: 'github',
    candidateTypeHint: 'issue',
    nextStepHint: 'Read the issue thread for confirmed workarounds, maintainer responses, and affected versions.',
    metadata: {
      repositoryUrl: repositoryUrlFromApiUrl(issue.repository_url),
      createdDate: issue.created_at ? new Date(issue.created_at) : undefined,
      lastCommitDate: issue.updated_at ? new Date(issue.updated_at) : undefined,
      ownerType: issue.user.type === 'Organization' ? 'organization' : 'user',
    },
  };
}

function repoNameFromApiUrl(repositoryUrl: string): string {
  const marker = '/repos/';
  const markerIndex = repositoryUrl.indexOf(marker);
  if (markerIndex === -1) return repositoryUrl;
  return repositoryUrl.slice(markerIndex + marker.length);
}

function repositoryUrlFromApiUrl(repositoryUrl: string): string | undefined {
  const repoName = repoNameFromApiUrl(repositoryUrl);
  return repoName === repositoryUrl ? undefined : `https://github.com/${repoName}`;
}

function deduplicateById(candidates: readonly RawCandidate[]): readonly RawCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.id.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function mapRepoWithReadme(
  repo: GitHubRepo,
  env: Env,
): Promise<RawCandidate> {
  const readmeSnippet = await fetchReadme(repo.full_name, repo.default_branch, env);
  const readmeMeta = readmeSnippet
    ? extractReadmeMetadata(readmeSnippet)
    : { hasInstallInstructions: false, hasExampleConfig: false, hasSuspiciousInstallScript: false };

  return {
    id: repo.html_url,
    name: repo.full_name,
    url: repo.html_url,
    description: repo.description ?? '',
    readmeSnippet: readmeSnippet ?? undefined,
    provider: 'github',
    metadata: {
      repositoryUrl: repo.html_url,
      stars: repo.stargazers_count,
      license: repo.license?.spdx_id ?? undefined,
      lastCommitDate: repo.pushed_at ? new Date(repo.pushed_at) : undefined,
      createdDate: repo.created_at ? new Date(repo.created_at) : undefined,
      isArchived: repo.archived,
      openIssueCount: repo.open_issues_count,
      ownerType: repo.owner.type === 'Organization' ? 'organization' : 'user',
      hasInstallInstructions: readmeMeta.hasInstallInstructions,
      hasExampleConfig: readmeMeta.hasExampleConfig,
      hasSuspiciousInstallScript: readmeMeta.hasSuspiciousInstallScript,
    },
  };
}

async function fetchReadme(
  fullName: string,
  defaultBranch: string,
  env: Env,
): Promise<string | null> {
  if (!env.GITHUB_TOKEN) return null;

  // Try the default branch first, then fall back to main/master
  const branches = [
    defaultBranch,
    'main',
    'master',
  ].filter((b, i, arr) => arr.indexOf(b) === i); // deduplicate

  for (const branch of branches) {
    const readmeUrl = `https://raw.githubusercontent.com/${fullName}/${branch}/README.md`;

    try {
      const text = await fetchProviderText({
        provider: 'github',
        operation: 'GitHub README fetch',
        url: readmeUrl,
        timeoutMs: Math.min(env.REQUEST_TIMEOUT_MS, 5000),
        cacheKey: providerCacheKey('github', 'readme', `${fullName}:${branch}`, 1),
      });

      if (text.trim()) {
        return text.slice(0, MAX_README_BYTES);
      }
    } catch (error) {
      if (error instanceof ProviderError && error.kind === 'auth') throw error;
      // Try next branch
    }
  }

  return null;
}
