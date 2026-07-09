import type { Provider, RawCandidate } from './candidate.js';
import type { ParsedProblem } from './problem.js';
import type { RankedCandidate } from './score.js';

export type DiscoveryMode = 'mock' | 'real';
export type ProviderState = 'pending' | 'complete' | 'empty' | 'skipped' | 'failed';

export interface DiscoveryRequest {
  readonly problem: string;
  readonly stack: readonly string[];
  readonly constraints: readonly string[];
  readonly providers: readonly Provider[];
  readonly mode: DiscoveryMode;
  readonly maxResults: number;
}

export interface ProviderStatus {
  readonly provider: Provider;
  readonly state: ProviderState;
  readonly resultCount: number;
  readonly message?: string;
}

export interface EvidenceItem {
  readonly sourceUrl: string;
  readonly sourceKind: Provider;
  readonly title: string;
  readonly excerpt?: string;
  readonly retrievedAt: string;
}

export interface ValidationStep {
  readonly id: string;
  readonly instruction: string;
  readonly expectedObservation: string;
  readonly riskNote?: string;
}

export interface SolutionCandidate extends RankedCandidate {
  readonly solutionKey: string;
  readonly evidence: readonly EvidenceItem[];
  readonly relatedCandidates: readonly RawCandidate[];
  readonly validationSteps: readonly ValidationStep[];
}

export interface DiscoveryResult {
  readonly request: DiscoveryRequest;
  readonly parsedProblem: ParsedProblem;
  readonly searchPlan: readonly {
    readonly query: string;
    readonly category: string;
    readonly providers: readonly Provider[];
  }[];
  readonly providerStatus: readonly ProviderStatus[];
  readonly candidates: readonly SolutionCandidate[];
  readonly completedAt: string;
}

export function buildDiscoveryRequest(input: DiscoveryRequest): DiscoveryRequest {
  return {
    ...input,
    problem: input.problem.trim(),
    stack: input.stack.map((item) => item.trim()).filter(Boolean),
    constraints: input.constraints.map((item) => item.trim()).filter(Boolean),
  };
}
