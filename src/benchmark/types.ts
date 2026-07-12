import type { Provider } from '../types/candidate.js';
import type { ProviderState } from '../types/discovery.js';
import type { TrustLevel } from '../types/score.js';

export interface ApprovedCandidateMatcher {
  readonly url?: string;
  readonly name?: string;
}

export interface BenchmarkCase {
  readonly id: string;
  readonly problem: string;
  readonly stack: readonly string[];
  readonly constraints: readonly string[];
  readonly providers: readonly Provider[];
  readonly maxResults: number;
  readonly topN: number;
  readonly requiredProviders: readonly Provider[];
  readonly approvedCandidates: readonly ApprovedCandidateMatcher[];
}

export type BenchmarkOutcome = 'passed' | 'regressed' | 'inconclusive';

export interface BenchmarkProviderRecord {
  readonly provider: Provider;
  readonly state: ProviderState;
  readonly resultCount: number;
  readonly message?: string;
}

export interface BenchmarkCandidateRecord {
  readonly url: string;
  readonly name: string;
  readonly provider: Provider;
  readonly score: number;
  readonly trustLevel: TrustLevel;
  readonly penaltyCount: number;
  readonly warningCategories: readonly string[];
}

export interface BenchmarkCaseReport {
  readonly id: string;
  readonly requiredProviders: readonly Provider[];
  readonly relevance: { readonly passed: boolean };
  readonly safety: { readonly passed: boolean };
  readonly providerCoverage: {
    readonly configured: number;
    readonly completedWithResults: number;
  };
  readonly outcome: BenchmarkOutcome;
  readonly elapsedMs: number;
  readonly providers: readonly BenchmarkProviderRecord[];
  readonly candidates: readonly BenchmarkCandidateRecord[];
}

export interface BenchmarkRunReport {
  readonly cases: readonly BenchmarkCaseReport[];
}

export interface BenchmarkComparison {
  readonly outcome: BenchmarkOutcome;
  readonly reasons: readonly string[];
}
