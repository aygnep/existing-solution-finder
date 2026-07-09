import { generateQueries } from './query-generator.js';
import { parseProblem } from './problem-parser.js';
import { rankCandidates } from './ranker.js';
import { scoreAndAttach } from './scorer.js';
import { groupSolutions } from './solution-grouper.js';
import { createValidationSteps } from './validation-guidance.js';
import {
  buildDiscoveryRequest,
  type DiscoveryRequest,
  type DiscoveryResult,
  type ProviderStatus,
} from '../types/discovery.js';
import type { Provider, Query, RawCandidate } from '../types/candidate.js';

export interface SkippedProviderResult {
  readonly raw: readonly RawCandidate[];
  readonly state: 'skipped';
  readonly message: string;
}

export type ProviderSearchResult = readonly RawCandidate[] | SkippedProviderResult;

export interface DiscoverySearchers {
  readonly github: (queries: readonly Query[]) => Promise<ProviderSearchResult>;
  readonly npm: (queries: readonly Query[]) => Promise<ProviderSearchResult>;
  readonly web: (queries: readonly Query[]) => Promise<ProviderSearchResult>;
}

export interface DiscoverSolutionsOptions {
  readonly request: DiscoveryRequest;
  readonly now: Date;
  readonly searchers: DiscoverySearchers;
}

interface ProviderRun extends ProviderStatus {
  readonly raw: readonly RawCandidate[];
}

export async function discoverSolutions(
  options: DiscoverSolutionsOptions,
): Promise<DiscoveryResult> {
  const request = buildDiscoveryRequest(options.request);
  const parsedProblem = parseProblem(buildProblemText(request));
  const queries = generateQueries(parsedProblem);
  const runs = await Promise.all(request.providers.map((provider) =>
    runProvider(provider, queries.filter((query) => query.providers.includes(provider)), options.searchers),
  ));
  const ranked = rankCandidates(
    runs.flatMap((run) => run.raw).map((candidate) =>
      scoreAndAttach(candidate, parsedProblem, options.now.getTime()),
    ),
    { maxResults: request.maxResults },
  );

  return {
    request,
    parsedProblem,
    searchPlan: queries.map((query) => ({
      query: query.text,
      category: query.category,
      providers: query.providers,
    })),
    providerStatus: runs.map(({ raw: _raw, ...status }) => status),
    candidates: groupSolutions(ranked, options.now).map((candidate) => ({
      ...candidate,
      validationSteps: createValidationSteps(candidate),
    })),
    completedAt: options.now.toISOString(),
  };
}

async function runProvider(
  provider: Provider,
  queries: readonly Query[],
  searchers: DiscoverySearchers,
): Promise<ProviderRun> {
  if (queries.length === 0) {
    return { provider, state: 'skipped', resultCount: 0, message: 'No compatible queries were generated.', raw: [] };
  }

  try {
    const result = await searchers[provider](queries);
    if (isSkippedResult(result)) {
      return { provider, state: 'skipped', resultCount: 0, message: result.message, raw: result.raw };
    }
    return {
      provider,
      state: result.length === 0 ? 'empty' : 'complete',
      resultCount: result.length,
      raw: result,
    };
  } catch (error) {
    return { provider, state: 'failed', resultCount: 0, message: safeMessage(error), raw: [] };
  }
}

function isSkippedResult(result: ProviderSearchResult): result is SkippedProviderResult {
  return typeof result === 'object' && result !== null && 'state' in result && result.state === 'skipped';
}

function buildProblemText(request: DiscoveryRequest): string {
  const sections = [request.problem];
  if (request.stack.length > 0) sections.push(`Stack: ${request.stack.join(', ')}`);
  if (request.constraints.length > 0) sections.push(`Constraints: ${request.constraints.join(', ')}`);
  return sections.join('\n');
}

function safeMessage(error: unknown): string {
  return String(error)
    .replace(/ghp_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]');
}
