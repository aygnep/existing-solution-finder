import type {
  ProviderEvidence,
  Query,
  RawCandidate,
} from '../types/candidate.js';
import type { Env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import {
  ProviderError,
  fetchProviderJson,
  invalidateProviderCache,
  mapWithConcurrency,
  providerCacheKey,
} from './provider-runtime.js';

const MAX_README_BYTES = 8192;
const METADATA_CONCURRENCY = 3;

interface NpmSearchResult {
  package: {
    name: string;
    description?: string;
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
  objects?: NpmSearchResult[];
  total?: number;
}

interface NpmPackageVersion {
  version?: string;
  description?: string;
  license?: string | { type?: string };
  repository?: string | { url?: string };
  readme?: string;
}

interface NpmPackageMetadata extends NpmPackageVersion {
  readonly 'dist-tags'?: { readonly latest?: string };
  readonly versions?: Record<string, NpmPackageVersion>;
  readonly time?: Record<string, string>;
}

export interface NpmEvidenceMetadata extends ProviderEvidence {
  readonly registryUrl: string;
  readonly latestVersion?: string;
  readonly updatedAt?: string;
  readonly metadataStatus: 'complete' | 'degraded';
}

export interface NpmRawCandidate extends RawCandidate {
  readonly providerEvidence: NpmEvidenceMetadata;
}

/**
 * Searches the npm registry, then enriches each bounded result with registry
 * package metadata. A package-level metadata failure degrades only that
 * candidate; failure of the primary search is propagated.
 */
export async function searchPackages(
  query: Query,
  env: Env,
): Promise<readonly NpmRawCandidate[]> {
  const resultLimit = Math.min(env.MAX_RESULTS_PER_PROVIDER, 20);
  const url = new URL('https://registry.npmjs.org/-/v1/search');
  url.searchParams.set('text', query.text);
  url.searchParams.set('size', String(resultLimit));

  logger.debug('npm package search started');

  const cacheKey = providerCacheKey('npm', 'search', query.text, resultLimit);
  const data = await fetchProviderJson<NpmSearchResponse>({
    provider: 'npm',
    operation: 'npm package search',
    url,
    requestInit: { headers: { Accept: 'application/json' } },
    timeoutMs: env.REQUEST_TIMEOUT_MS,
    cacheKey,
  });

  if (!Array.isArray(data.objects)) {
    invalidateProviderCache(cacheKey);
    throw new ProviderError({
      provider: 'npm',
      operation: 'npm package search',
      kind: 'invalid-json',
      retryable: false,
    });
  }

  return mapWithConcurrency(
    data.objects.slice(0, resultLimit),
    METADATA_CONCURRENCY,
    (result) => enrichNpmResult(result, env),
  );
}

async function enrichNpmResult(
  result: NpmSearchResult,
  env: Env,
): Promise<NpmRawCandidate> {
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(result.package.name)}`;

  try {
    const metadata = await fetchProviderJson<NpmPackageMetadata>({
      provider: 'npm',
      operation: 'npm package metadata',
      url: registryUrl,
      requestInit: { headers: { Accept: 'application/json' } },
      timeoutMs: env.REQUEST_TIMEOUT_MS,
      cacheKey: providerCacheKey('npm', 'metadata', result.package.name, 1),
    });
    return mapNpmResult(result, registryUrl, metadata);
  } catch (error) {
    const failure = error instanceof ProviderError ? error.message : '[npm] metadata unavailable';
    logger.warn('npm metadata enrichment degraded', {
      package: result.package.name,
      failure,
    });
    return mapNpmResult(result, registryUrl);
  }
}

function mapNpmResult(
  result: NpmSearchResult,
  registryUrl: string,
  metadata?: NpmPackageMetadata,
): NpmRawCandidate {
  const searchPackage = result.package;
  const latestVersion = metadata?.['dist-tags']?.latest ?? searchPackage.version;
  const latestData = latestVersion ? metadata?.versions?.[latestVersion] : undefined;
  const readme = metadata?.readme ?? latestData?.readme;
  const repositoryUrl = normalizeRepository(
    latestData?.repository ?? metadata?.repository ?? searchPackage.links.repository,
  );
  const license = normalizeLicense(latestData?.license ?? metadata?.license);
  const updatedAt = latestVersion
    ? metadata?.time?.[latestVersion] ?? metadata?.time?.modified ?? searchPackage.date
    : metadata?.time?.modified ?? searchPackage.date;
  const description = latestData?.description ?? metadata?.description ?? searchPackage.description ?? '';
  const canonicalUrl = repositoryUrl ?? searchPackage.links.homepage ?? searchPackage.links.npm;

  return {
    id: searchPackage.links.npm,
    name: searchPackage.name,
    url: canonicalUrl,
    description,
    readmeSnippet: readme?.slice(0, MAX_README_BYTES),
    provider: 'npm',
    metadata: {
      repositoryUrl,
      license,
      lastCommitDate: toValidDate(updatedAt),
      hasInstallInstructions: true,
    },
    providerEvidence: {
      registryUrl,
      latestVersion,
      updatedAt,
      metadataStatus: metadata ? 'complete' : 'degraded',
    },
  };
}

function normalizeLicense(
  license: string | { type?: string } | undefined,
): string | undefined {
  if (typeof license === 'string') return license || undefined;
  return license?.type || undefined;
}

function normalizeRepository(
  repository: string | { url?: string } | undefined,
): string | undefined {
  const raw = typeof repository === 'string' ? repository : repository?.url;
  if (!raw) return undefined;

  return raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '');
}

function toValidDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
