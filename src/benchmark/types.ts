import type { Provider } from '../types/candidate.js';

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
