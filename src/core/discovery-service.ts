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
  type HandoffItem,
  type ProviderStatus,
  type RerankerProvider,
  type SolutionCandidate,
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
  readonly reranker?: DecisionReranker;
}

export interface DecisionRerankInput {
  readonly problem: string;
  readonly stack: readonly string[];
  readonly constraints: readonly string[];
  readonly candidates: readonly SolutionCandidate[];
}

export interface DecisionRerankResult {
  readonly model: string;
  readonly judgments: readonly {
    readonly solutionKey: string;
    readonly relevanceProbability: number;
    readonly compatibilityProbability: number;
    readonly evidenceProbability: number;
    readonly model: string;
  }[];
}

export interface DecisionReranker {
  readonly evaluate: (input: DecisionRerankInput) => Promise<DecisionRerankResult>;
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
  const ruleCandidates = groupSolutions(ranked, options.now, scored);
  let candidates = ruleCandidates;
  let reranking: NonNullable<DiscoveryResult['reranking']> = {
    provider: 'none', state: 'disabled', evaluatedCount: 0,
  };

  if (request.reranker) {
    const provider: RerankerProvider = request.reranker;
    const providerName = provider === 'jev' ? 'Jev' : 'Laya';
    if (request.mode === 'mock') {
      reranking = { provider, state: 'skipped', evaluatedCount: 0, message: `${providerName} is unavailable in mock mode.` };
    } else if (!options.reranker) {
      reranking = { provider, state: 'skipped', evaluatedCount: 0,
        message: provider === 'jev' ? 'TYPESAFE_API_KEY is not configured; rule ranking was retained.' : 'Laya reranker is not configured; rule ranking was retained.' };
    } else {
      const shortlistSize = Math.min(30, Math.max(request.maxResults, request.maxResults * 3));
      const shortlist = groupSolutions(
        rankCandidates(representatives, { maxResults: shortlistSize }), options.now, scored,
      );
      try {
        const evaluated = await options.reranker.evaluate({
          problem: request.problem,
          stack: request.stack,
          constraints: request.constraints,
          candidates: shortlist,
        });
        const judgments = new Map(evaluated.judgments.map((item) => [item.solutionKey, item]));
        if (judgments.size !== shortlist.length || evaluated.judgments.some((item) =>
          !Number.isFinite(item.relevanceProbability) || !Number.isFinite(item.compatibilityProbability) ||
          !Number.isFinite(item.evidenceProbability) ||
          item.relevanceProbability < 0 || item.relevanceProbability > 1 ||
          item.compatibilityProbability < 0 || item.compatibilityProbability > 1 ||
          item.evidenceProbability < 0 || item.evidenceProbability > 1)) {
          throw new Error('Incomplete reranker judgments.');
        }
        const decisionOrdered = shortlist.map((candidate) => {
          const judgment = judgments.get(candidate.solutionKey);
          if (!judgment) throw new Error('Missing reranker judgment.');
          return {
            ...candidate,
            decision: {
              provider,
              model: judgment.model,
              relevanceProbability: judgment.relevanceProbability,
              compatibilityProbability: judgment.compatibilityProbability,
              evidenceProbability: judgment.evidenceProbability,
              ruleRank: candidate.rank,
            },
          };
        }).sort((left, right) => {
          const blocked = Number(left.score.trustLevel === 'BLOCKED') - Number(right.score.trustLevel === 'BLOCKED');
          if (blocked !== 0) return blocked;
          return (Math.min(right.decision.relevanceProbability, right.decision.compatibilityProbability) -
            Math.min(left.decision.relevanceProbability, left.decision.compatibilityProbability)) ||
            (right.decision.evidenceProbability - left.decision.evidenceProbability) ||
            (left.decision.ruleRank - right.decision.ruleRank);
        });
        const evaluatedKeys = new Set(shortlist.map((candidate) => candidate.solutionKey));
        const ruleAnchorKey = provider === 'laya'
          ? ruleCandidates.find((candidate) => candidate.score.trustLevel !== 'BLOCKED')?.solutionKey
          : undefined;
        const ruleAnchor = ruleAnchorKey
          ? decisionOrdered.find((candidate) => candidate.solutionKey === ruleAnchorKey)
          : undefined;
        const combined = [
          ...(ruleAnchor ? [ruleAnchor] : []),
          ...decisionOrdered.filter((candidate) => candidate.solutionKey !== ruleAnchorKey),
          ...ruleCandidates.filter((candidate) => !evaluatedKeys.has(candidate.solutionKey)),
        ];
        candidates = [...combined.filter((candidate) => candidate.score.trustLevel !== 'BLOCKED'),
          ...combined.filter((candidate) => candidate.score.trustLevel === 'BLOCKED')]
          .slice(0, request.maxResults)
          .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
        reranking = { provider, state: 'complete', model: evaluated.model, evaluatedCount: shortlist.length,
          strategy: provider === 'laya' ? 'rule-anchor' : 'model-order' };
      } catch {
        reranking = { provider, state: 'failed', evaluatedCount: 0, message: `${providerName} reranking failed; rule ranking was retained.` };
      }
    }
  }

  return {
    request,
    parsedProblem,
    searchPlan: queries.map((query) => ({
      query: query.text,
      category: query.category,
      providers: query.providers,
    })),
    providerStatus: runs.map(({ raw: _raw, ...status }) => status),
    candidates,
    handoff: createHandoff(candidates),
    reranking,
    completedAt: options.now.toISOString(),
  };
}

function createHandoff(candidates: readonly SolutionCandidate[]): readonly HandoffItem[] {
  return candidates.filter((candidate) => candidate.score.trustLevel !== 'BLOCKED')
    .slice(0, 3)
    .map((candidate) => ({
      solutionKey: candidate.solutionKey,
      url: candidate.url,
      name: candidate.name,
      ruleScore: candidate.score.displayTotal,
      sourceUrls: candidate.evidence.map((item) => item.sourceUrl),
      ...(candidate.decision ? { decision: candidate.decision } : {}),
    }));
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
