import type { Env } from '../utils/env.js';
import type { Query, RawCandidate } from '../types/candidate.js';
import { logger } from '../utils/logger.js';

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

interface SerpApiResponse {
  organic_results?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
}

/**
 * Searches the web for candidates using the configured provider.
 *
 * Currently supports: Brave Search API and SerpApi.
 * Returns empty array if WEB_SEARCH_API_KEY is not configured.
 */
export async function searchWeb(
  query: Query,
  env: Env,
): Promise<readonly RawCandidate[]> {
  if (!env.WEB_SEARCH_API_KEY) {
    logger.debug('Web search skipped: WEB_SEARCH_API_KEY not configured');
    return [];
  }

  const provider = env.WEB_SEARCH_PROVIDER ?? 'brave';

  if (provider === 'brave') {
    return searchBrave(query, env);
  }

  if (provider === 'serpapi') {
    return searchSerpApi(query, env);
  }

  logger.warn('Unsupported web search provider', { provider });
  return [];
}

// ─── SerpApi ──────────────────────────────────────────────────────────────────

async function searchSerpApi(query: Query, env: Env): Promise<readonly RawCandidate[]> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query.text);
  url.searchParams.set('num', String(Math.min(env.MAX_RESULTS_PER_PROVIDER, 20)));
  url.searchParams.set('api_key', env.WEB_SEARCH_API_KEY ?? '');

  logger.debug('SerpApi web search', { query: query.text });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(env.REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn('SerpApi search request failed', { error: String(err) });
    return [];
  }

  if (!response.ok) {
    logger.warn('SerpApi search returned non-OK status', {
      status: response.status,
      query: query.text,
    });
    return [];
  }

  let data: SerpApiResponse;
  try {
    data = (await response.json()) as SerpApiResponse;
  } catch {
    logger.warn('SerpApi search response parse failed');
    return [];
  }

  return (data.organic_results ?? [])
    .filter((result): result is { title: string; link: string; snippet?: string } =>
      Boolean(result.title && result.link),
    )
    .map((result) => ({
      id: result.link,
      name: result.title,
      url: result.link,
      description: result.snippet ?? '',
      provider: 'web' as const,
      metadata: {},
    }));
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

async function searchBrave(query: Query, env: Env): Promise<readonly RawCandidate[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query.text);
  url.searchParams.set('count', String(Math.min(env.MAX_RESULTS_PER_PROVIDER, 20)));

  logger.debug('Brave web search', { query: query.text });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': env.WEB_SEARCH_API_KEY ?? '',
      },
      signal: AbortSignal.timeout(env.REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn('Brave search request failed', { error: String(err) });
    return [];
  }

  if (!response.ok) {
    logger.warn('Brave search returned non-OK status', {
      status: response.status,
      query: query.text,
    });
    return [];
  }

  let data: BraveSearchResponse;
  try {
    data = (await response.json()) as BraveSearchResponse;
  } catch {
    logger.warn('Brave search response parse failed');
    return [];
  }

  return (data.web?.results ?? []).map((result) => ({
    id: result.url,
    name: result.title,
    url: result.url,
    description: result.description,
    provider: 'web' as const,
    metadata: {
      // Web results don't provide repo metadata; scorer will use heuristics
    },
  }));
}
