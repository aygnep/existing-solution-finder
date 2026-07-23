export const OUTCOME_SCHEMA_VERSION = 1 as const;

export type CandidateOutcome = 'useful' | 'not-useful' | 'unsafe';

export interface OutcomeInput {
  readonly candidateUrl: string;
  readonly problemFingerprint: string;
  readonly outcome: CandidateOutcome;
  readonly notes?: string;
}

export interface OutcomeRecord extends OutcomeInput {
  readonly schemaVersion: typeof OUTCOME_SCHEMA_VERSION;
  readonly timestamp: string;
}

export interface AppendOutcomeOptions {
  readonly now?: Date;
}
