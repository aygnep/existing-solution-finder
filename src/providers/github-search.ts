import type { Env } from '../utils/env.js';
import type { Query, RawCandidate } from '../types/candidate.js';
import { logger } from '../utils/logger.js';

/** Maximum length for a GitHub search query to avoid API errors */
const MAX_QUERY_LENGTH = 256;

/** Maximum README bytes to fetch */
const MAX_README_BYTES = 8192;

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
      query: sanitizedQuery,
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

  // Map repos and fetch READMEs in parallel
  const candidates = await Promise.all(
    data.items.map((repo) => mapRepoWithReadme(repo, env)),
  );

  return candidates;
}

/**
 * Searches GitHub across multiple queries and deduplicates results by full_name.
 * When a repo appears in multiple query results, the first occurrence is kept.
 */
export async function searchGitHubMultiQuery(
  queries: readonly Query[],
  env: Env,
): Promise<readonly RawCandidate[]> {
  const allResults = await Promise.all(queries.map((q) => searchGitHub(q, env)));
  return deduplicateByFullName(allResults.flat());
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
      const response = await fetch(readmeUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) continue;

      const text = await response.text();
      if (text.trim()) {
        return text.slice(0, MAX_README_BYTES);
      }
    } catch {
      // Try next branch
    }
  }

  return null;
}
