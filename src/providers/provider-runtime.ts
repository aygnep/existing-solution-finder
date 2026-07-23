import type { Provider } from '../types/candidate.js';

export type ProviderFailureKind =
  | 'auth'
  | 'rate-limit'
  | 'timeout'
  | 'transport'
  | 'invalid-json'
  | 'not-found'
  | 'http';

export interface ProviderErrorOptions {
  readonly provider: Provider;
  readonly operation: string;
  readonly kind: ProviderFailureKind;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
}

/**
 * A deliberately redacted provider failure.
 *
 * The message is assembled exclusively from controlled fields. Response
 * bodies, request URLs, queries, tokens, and native transport messages are
 * never included.
 */
export class ProviderError extends Error {
  readonly provider: Provider;
  readonly operation: string;
  readonly kind: ProviderFailureKind;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(options: ProviderErrorOptions) {
    const status = options.status === undefined ? '' : `, status=${options.status}`;
    super(
      `[${options.provider}] provider request failed `
      + `(kind=${options.kind}${status}, retryable=${String(options.retryable)})`,
    );
    this.name = 'ProviderError';
    this.provider = options.provider;
    this.operation = options.operation;
    this.kind = options.kind;
    this.status = options.status;
    this.retryable = options.retryable;
    this.retryAfterMs = options.retryAfterMs;
  }
}

interface CacheEntry {
  readonly expiresAt: number;
  readonly value: unknown;
}

interface RuntimeHooks {
  readonly now: () => number;
  readonly sleep: (delayMs: number) => Promise<void>;
}

export interface ProviderFetchOptions {
  readonly provider: Provider;
  readonly operation: string;
  readonly url: string | URL;
  readonly requestInit?: RequestInit;
  readonly timeoutMs: number;
  /**
   * Must not include credentials or raw user input. Use providerCacheKey() to
   * hash query text before constructing a key.
   */
  readonly cacheKey?: string;
  readonly cacheTtlMs?: number;
  readonly maxAttempts?: number;
  readonly maxRetryDelayMs?: number;
}

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 100;
const DEFAULT_MAX_RETRY_DELAY_MS = 1_000;

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

const defaultHooks: RuntimeHooks = {
  now: () => Date.now(),
  sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
};

let runtimeHooks = defaultHooks;

export async function fetchProviderJson<T>(
  options: ProviderFetchOptions,
): Promise<T> {
  return withCache(options, () => withRetry(options, async () => {
    const response = await fetchProviderResponse(options);
    try {
      return (await response.json()) as T;
    } catch {
      throw new ProviderError({
        provider: options.provider,
        operation: options.operation,
        kind: 'invalid-json',
        status: response.status,
        retryable: false,
      });
    }
  }));
}

export async function fetchProviderText(
  options: ProviderFetchOptions,
): Promise<string> {
  return withCache(options, () => withRetry(options, async () => {
    const response = await fetchProviderResponse(options);
    return response.text();
  }));
}

async function fetchProviderResponse(
  options: ProviderFetchOptions,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(options.url.toString(), {
      ...options.requestInit,
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    throw new ProviderError({
      provider: options.provider,
      operation: options.operation,
      kind: isTimeoutError(error) ? 'timeout' : 'transport',
      retryable: true,
    });
  }

  if (!response.ok) {
    throw errorFromHttpStatus(
      options.provider,
      options.operation,
      response.status,
      parseRetryAfter(response.headers.get('retry-after')),
    );
  }

  return response;
}

async function withRetry<T>(
  options: ProviderFetchOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const maxDelay = Math.max(0, options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      if (!error.retryable || attempt === maxAttempts) throw error;

      const exponentialDelay = DEFAULT_RETRY_DELAY_MS * (2 ** (attempt - 1));
      const requestedDelay = error.retryAfterMs ?? exponentialDelay;
      await runtimeHooks.sleep(Math.min(requestedDelay, maxDelay));
    }
  }

  throw new Error('Unreachable provider retry state');
}

async function withCache<T>(
  options: ProviderFetchOptions,
  load: () => Promise<T>,
): Promise<T> {
  if (!options.cacheKey) return load();

  const cached = responseCache.get(options.cacheKey);
  if (cached && cached.expiresAt > runtimeHooks.now()) {
    return cached.value as T;
  }
  if (cached) responseCache.delete(options.cacheKey);

  const pending = inFlight.get(options.cacheKey);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      responseCache.set(options.cacheKey!, {
        value,
        expiresAt: runtimeHooks.now() + (options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS),
      });
      return value;
    })
    .finally(() => {
      inFlight.delete(options.cacheKey!);
    });

  inFlight.set(options.cacheKey, request);
  return request;
}

export function errorFromHttpStatus(
  provider: Provider,
  operation: string,
  status: number,
  retryAfterMs?: number,
): ProviderError {
  let kind: ProviderFailureKind = 'http';
  let retryable = false;

  if (status === 401 || status === 403) {
    kind = provider === 'github' && status === 403 ? 'rate-limit' : 'auth';
    retryable = kind === 'rate-limit';
  } else if (status === 404) {
    kind = 'not-found';
  } else if (status === 429) {
    kind = 'rate-limit';
    retryable = true;
  } else if (status >= 500) {
    retryable = true;
  }

  return new ProviderError({
    provider,
    operation,
    kind,
    status,
    retryable,
    retryAfterMs,
  });
}

export function providerCacheKey(
  provider: Provider,
  operation: string,
  query: string,
  resultLimit: number,
): string {
  return `${provider}:${operation}:${stableHash(query)}:${resultLimit}`;
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  if (values.length === 0) return [];

  const results = new Array<R>(values.length);
  const workerCount = Math.min(values.length, Math.max(1, Math.floor(concurrency)));
  let nextIndex = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return undefined;
  return Math.max(0, retryAt - runtimeHooks.now());
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error
    && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

export function setProviderRuntimeHooksForTests(
  hooks: Partial<RuntimeHooks>,
): void {
  runtimeHooks = { ...runtimeHooks, ...hooks };
}

export function resetProviderRuntimeForTests(): void {
  responseCache.clear();
  inFlight.clear();
  runtimeHooks = defaultHooks;
}

export function invalidateProviderCache(cacheKey: string): void {
  responseCache.delete(cacheKey);
  inFlight.delete(cacheKey);
}
