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

/**
 * Searches the web for candidates using the configured provider.
 *
 * Currently supports: Brave Search API.
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

  logger.warn('Unsupported web search provider', { provider });
  return [];
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
