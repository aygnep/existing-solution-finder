import type { Env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import {
  ProviderError,
  fetchProviderJson,
  providerCacheKey,
  type ProviderFailureKind,
} from './provider-runtime.js';

export type GitHubApiFailureKind = ProviderFailureKind;

export interface GitHubApiFailure {
  readonly kind: GitHubApiFailureKind;
  readonly status?: number;
  readonly message: string;
  readonly provider: 'github';
  readonly retryable: boolean;
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
  return 'http';
}

export async function fetchGitHubJson<T>(
  url: URL,
  env: Env,
  context: GitHubRequestContext,
): Promise<GitHubApiResult<T>> {
  try {
    const data = await fetchProviderJson<T>({
      provider: 'github',
      operation: context.requestName,
      url,
      requestInit: {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN ?? ''}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
      timeoutMs: env.REQUEST_TIMEOUT_MS,
      cacheKey: providerCacheKey(
        'github',
        context.requestName,
        context.query,
        env.MAX_RESULTS_PER_PROVIDER,
      ),
    });
    return { ok: true, data };
  } catch (error) {
    const providerError = error instanceof ProviderError
      ? error
      : new ProviderError({
        provider: 'github',
        operation: context.requestName,
        kind: 'transport',
        retryable: true,
      });
    const failure: GitHubApiFailure = {
      kind: providerError.kind,
      status: providerError.status,
      message: providerError.message,
      provider: 'github',
      retryable: providerError.retryable,
    };
    logger.warn(failure.message);
    return { ok: false, failure };
  }
}

export function gitHubFailureAsError(failure: GitHubApiFailure): ProviderError {
  return new ProviderError({
    provider: failure.provider,
    operation: 'GitHub API request',
    kind: failure.kind,
    status: failure.status,
    retryable: failure.retryable,
  });
}
