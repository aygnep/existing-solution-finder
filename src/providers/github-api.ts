import type { Env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

export type GitHubApiFailureKind =
  | 'auth'
  | 'rate-limit'
  | 'not-found'
  | 'invalid-json'
  | 'network'
  | 'other';

export interface GitHubApiFailure {
  readonly kind: GitHubApiFailureKind;
  readonly status?: number;
  readonly message: string;
}

export interface GitHubApiSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export interface GitHubApiFailureResult {
  readonly ok: false;
  readonly failure: GitHubApiFailure;
}

export type GitHubApiResult<T> = GitHubApiSuccess<T> | GitHubApiFailureResult;

export interface GitHubRequestContext {
  readonly requestName: string;
  readonly query: string;
}

export function classifyGitHubStatus(status: number): GitHubApiFailureKind {
  if (status === 401) return 'auth';
  if (status === 403 || status === 429) return 'rate-limit';
  if (status === 404) return 'not-found';
  return 'other';
}

export async function fetchGitHubJson<T>(
  url: URL,
  env: Env,
  context: GitHubRequestContext,
): Promise<GitHubApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN ?? ''}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(env.REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const failure: GitHubApiFailure = {
      kind: 'network',
      message: `${context.requestName} request failed for query "${context.query}": ${String(err)}`,
    };
    logger.warn(failure.message);
    return { ok: false, failure };
  }

  if (!response.ok) {
    const failure: GitHubApiFailure = {
      kind: classifyGitHubStatus(response.status),
      status: response.status,
      message: `${context.requestName} returned HTTP ${response.status} for query "${context.query}"`,
    };
    logger.warn(failure.message);
    return { ok: false, failure };
  }

  try {
    return { ok: true, data: (await response.json()) as T };
  } catch {
    const failure: GitHubApiFailure = {
      kind: 'invalid-json',
      message: `${context.requestName} returned invalid JSON for query "${context.query}"`,
    };
    logger.warn(failure.message);
    return { ok: false, failure };
  }
}
