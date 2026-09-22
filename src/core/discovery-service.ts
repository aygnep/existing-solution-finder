import { generateQueries } from './query-generator.js';
import { parseProblem } from './problem-parser.js';
import { rankCandidates } from './ranker.js';
import { scoreAndAttach } from './scorer.js';
import { groupSolutions, solutionKeyFor } from './solution-grouper.js';
import { redactSensitiveText } from '../feedback/redaction.js';
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

export interface PartialProviderResult {
  readonly raw: readonly RawCandidate[];
  readonly state: 'partial';
  readonly message: string;
}

export type ProviderSearchResult = readonly RawCandidate[] | SkippedProviderResult | PartialProviderResult;

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
  const scored = runs.flatMap((run) => run.raw).map((candidate) =>
    scoreAndAttach(candidate, parsedProblem, options.now.getTime()),
  );
  const membersBySolution = new Map<string, typeof scored>();
  for (const candidate of scored) {
    const key = solutionKeyFor(candidate);
    membersBySolution.set(key, [...(membersBySolution.get(key) ?? []), candidate]);
  }
  const representatives = [...membersBySolution.values()].map((members) =>
    rankCandidates(members, { maxResults: 1 })[0]!,
  );
  const ranked = rankCandidates(representatives, { maxResults: request.maxResults });

  return {
    request,
    parsedProblem,
    searchPlan: queries.map((query) => ({
      query: query.text,
      category: query.category,
      providers: query.providers,
    })),
    providerStatus: runs.map(({ raw: _raw, ...status }) => status),
    candidates: groupSolutions(ranked, options.now, scored),
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
    if (isStatusResult(result)) {
      if (result.state === 'partial') {
        return { provider, state: 'partial', resultCount: result.raw.length, message: result.message, raw: result.raw };
      }
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

function isStatusResult(result: ProviderSearchResult): result is SkippedProviderResult | PartialProviderResult {
  return typeof result === 'object' && result !== null && 'state' in result;
}

function buildProblemText(request: DiscoveryRequest): string {
  const sections = [request.problem];
  if (request.stack.length > 0) sections.push(`Stack: ${request.stack.join(', ')}`);
  if (request.constraints.length > 0) sections.push(`Constraints: ${request.constraints.join(', ')}`);
  return sections.join('\n');
}

function safeMessage(error: unknown): string {
  return redactSensitiveText(String(error));
}
