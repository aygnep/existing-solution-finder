import type { Query, RawCandidate } from '../types/candidate.js';
import type { Env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

interface NpmSearchResult {
  package: {
    name: string;
    description: string;
    version: string;
    links: {
      npm: string;
      repository?: string;
      homepage?: string;
    };
    date: string;
  };
  score: {
    final: number;
  };
}

interface NpmSearchResponse {
  objects: NpmSearchResult[];
  total: number;
}

/**
 * Searches the npm registry for packages matching the query.
 *
 * Uses the npms.io API (no auth required).
 */
export async function searchPackages(
  query: Query,
  env: Env,
): Promise<readonly RawCandidate[]> {
  const url = new URL('https://registry.npmjs.org/-/v1/search');
  url.searchParams.set('text', query.text);
  url.searchParams.set('size', String(Math.min(env.MAX_RESULTS_PER_PROVIDER, 20)));

  logger.debug('npm search', { query: query.text });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(env.REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn('npm search request failed', { error: String(err) });
    return [];
  }

  if (!response.ok) {
    logger.warn('npm search returned non-OK status', {
      status: response.status,
      query: query.text,
    });
    return [];
  }

  let data: NpmSearchResponse;
  try {
    data = (await response.json()) as NpmSearchResponse;
  } catch {
    logger.warn('npm search response parse failed');
    return [];
  }

  return data.objects.map((obj) => mapNpmResult(obj));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapNpmResult(obj: NpmSearchResult): RawCandidate {
  const pkg = obj.package;
  const url = pkg.links.repository ?? pkg.links.homepage ?? pkg.links.npm;

  return {
    id: pkg.links.npm,
    name: pkg.name,
    url,
    description: pkg.description ?? '',
    provider: 'npm',
    metadata: {
      lastCommitDate: pkg.date ? new Date(pkg.date) : undefined,
      hasInstallInstructions: true, // npm packages always have npm install
    },
  };
}
