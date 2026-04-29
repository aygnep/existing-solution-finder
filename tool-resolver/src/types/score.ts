import type { RawCandidate } from './candidate.js';

/** Per-component score breakdown as defined in SCORING_RULES.md */
export interface ScoreBreakdown {
  readonly exactErrorMatch: number; // 0–25
  readonly stackMatch: number; // 0–20
  readonly readmeEvidence: number; // 0–15
  readonly recency: number; // 0–10
  readonly installationClarity: number; // 0–10
  readonly maintenanceActivity: number; // 0–10
  readonly exampleConfig: number; // 0–10
}

/** Applied penalty with reason */
export interface Penalty {
  readonly amount: number; // negative integer
  readonly reason: string;
}

/** Trust level as defined in SAFETY_RULES.md */
export type TrustLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKED';

/** Safety warning to surface in output */
export interface SafetyWarning {
  readonly category: string;
  readonly message: string;
}

/** Full score for a candidate */
export interface Score {
  readonly breakdown: ScoreBreakdown;
  readonly penalties: readonly Penalty[];
  /** Sum of breakdown fields */
  readonly subtotal: number;
  /** subtotal + sum of penalties (may be negative) */
  readonly total: number;
  /** Clamped to 0 for display */
  readonly displayTotal: number;
  readonly trustLevel: TrustLevel;
  readonly warnings: readonly SafetyWarning[];
}

/** A candidate that has been scored */
export interface ScoredCandidate extends RawCandidate {
  readonly score: Score;
}

/** A candidate that has been scored and ranked */
export interface RankedCandidate extends ScoredCandidate {
  readonly rank: number;
  /** One-sentence explanation of why this candidate matches */
  readonly matchReason: string;
}
