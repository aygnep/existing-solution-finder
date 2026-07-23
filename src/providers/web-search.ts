import type { Env } from '../utils/env.js';
import type {
  ProviderEvidence,
  Query,
  RawCandidate,
} from '../types/candidate.js';
import { logger } from '../utils/logger.js';
import {
  ProviderError,
  fetchProviderJson,
  invalidateProviderCache,
  providerCacheKey,
} from './provider-runtime.js';

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
  page_age?: string;
  age?: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

interface SerpApiOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  source?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
}

export interface WebEvidenceMetadata extends ProviderEvidence {
  readonly sourceUrl: string;
  readonly title: string;
  readonly snippet?: string;
  readonly publishedDate?: string;
  readonly sourceName?: string;
}

export interface WebRawCandidate extends RawCandidate {
  readonly providerEvidence: WebEvidenceMetadata;
}

/**
 * Searches the web for candidates using the configured provider.
 * Missing credentials remain a legitimate skip for compatibility; configured
 * provider failures throw a redacted ProviderError.
 */
export async function searchWeb(
  query: Query,
  env: Env,
): Promise<readonly WebRawCandidate[]> {
  if (!env.WEB_SEARCH_API_KEY) {
    logger.debug('Web search skipped: WEB_SEARCH_API_KEY not configured');
    return [];
  }

  const provider = env.WEB_SEARCH_PROVIDER ?? 'brave';

  if (provider === 'brave') return searchBrave(query, env);
  if (provider === 'serpapi') return searchSerpApi(query, env);

  throw new ProviderError({
    provider: 'web',
    operation: 'web search provider selection',
    kind: 'http',
    retryable: false,
  });
}

async function searchSerpApi(
  query: Query,
  env: Env,
): Promise<readonly WebRawCandidate[]> {
  const resultLimit = Math.min(env.MAX_RESULTS_PER_PROVIDER, 20);
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query.text);
  url.searchParams.set('num', String(resultLimit));
  url.searchParams.set('api_key', env.WEB_SEARCH_API_KEY ?? '');

  logger.debug('SerpApi web search started');

  const cacheKey = providerCacheKey('web', 'serpapi', query.text, resultLimit);
  const data = await fetchProviderJson<SerpApiResponse>({
    provider: 'web',
    operation: 'SerpApi web search',
    url,
    requestInit: { headers: { Accept: 'application/json' } },
    timeoutMs: env.REQUEST_TIMEOUT_MS,
    cacheKey,
  });

  if (data.error) {
    invalidateProviderCache(cacheKey);
    throw new ProviderError({
      provider: 'web',
      operation: 'SerpApi web search',
      kind: /key|credential|account|unauthorized/i.test(data.error) ? 'auth' : 'http',
      retryable: false,
    });
  }

  if (data.organic_results !== undefined && !Array.isArray(data.organic_results)) {
    invalidateProviderCache(cacheKey);
    throw new ProviderError({
      provider: 'web',
      operation: 'SerpApi web search',
      kind: 'invalid-json',
      retryable: false,
    });
  }

  return (data.organic_results ?? [])
    .filter((result): result is SerpApiOrganicResult & { title: string; link: string } =>
      Boolean(result.title && result.link),
    )
    .map((result) => mapWebResult({
      title: result.title,
      sourceUrl: result.link,
      snippet: result.snippet,
      publishedDate: result.date,
      sourceName: result.source,
    }));
}

async function searchBrave(
  query: Query,
  env: Env,
): Promise<readonly WebRawCandidate[]> {
  const resultLimit = Math.min(env.MAX_RESULTS_PER_PROVIDER, 20);
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query.text);
  url.searchParams.set('count', String(resultLimit));

  logger.debug('Brave web search started');

  const cacheKey = providerCacheKey('web', 'brave', query.text, resultLimit);
  const data = await fetchProviderJson<BraveSearchResponse>({
    provider: 'web',
    operation: 'Brave web search',
    url,
    requestInit: {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': env.WEB_SEARCH_API_KEY ?? '',
      },
    },
    timeoutMs: env.REQUEST_TIMEOUT_MS,
    cacheKey,
  });

  if (data.web?.results !== undefined && !Array.isArray(data.web.results)) {
    invalidateProviderCache(cacheKey);
    throw new ProviderError({
      provider: 'web',
      operation: 'Brave web search',
      kind: 'invalid-json',
      retryable: false,
    });
  }

  return (data.web?.results ?? [])
    .filter((result) => Boolean(result.title && result.url))
    .map((result) => mapWebResult({
      title: result.title,
      sourceUrl: result.url,
      snippet: result.description,
      publishedDate: result.page_age ?? result.age,
    }));
}

function mapWebResult(input: WebEvidenceMetadata): WebRawCandidate {
  return {
    id: input.sourceUrl,
    name: input.title,
    url: input.sourceUrl,
    description: input.snippet ?? '',
    provider: 'web',
    metadata: {
      createdDate: toValidDate(input.publishedDate),
    },
    providerEvidence: input,
  };
}

function toValidDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
