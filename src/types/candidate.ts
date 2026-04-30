/** Query categories as defined in SEARCH_STRATEGY.md */
export type QueryCategory =
  | 'exact-error'
  | 'stack-compatibility'
  | 'github-repos'
  | 'github-issues'
  | 'alternatives';

/** A single search query with routing metadata */
export interface Query {
  readonly text: string;
  readonly category: QueryCategory;
  /** Which providers should execute this query */
  readonly providers: readonly Provider[];
}

export type Provider = 'github' | 'web' | 'npm';

/**
 * A raw result from a provider before scoring.
 * Providers return this; scorer consumes it.
 */
export interface RawCandidate {
  readonly id: string; // unique within the result set (URL-based)
  readonly name: string;
  readonly url: string;
  readonly description: string;
  readonly readmeSnippet?: string;
  readonly provider: Provider;
  readonly metadata: CandidateMetadata;
  /** Optional type hint from the provider (tool / issue / workaround) */
  readonly candidateTypeHint?: 'tool' | 'issue' | 'workaround';
  /** Optional next-step suggestion from the provider */
  readonly nextStepHint?: string;
}

/** Metadata used by the scorer. All fields are optional — providers may not have all info. */
export interface CandidateMetadata {
  readonly stars?: number;
  readonly license?: string;
  readonly lastCommitDate?: Date;
  readonly isArchived?: boolean;
  readonly openIssueCount?: number;
  readonly createdDate?: Date;
  readonly ownerType?: 'user' | 'organization';
  readonly hasInstallInstructions?: boolean;
  readonly hasExampleConfig?: boolean;
  readonly hasSuspiciousInstallScript?: boolean;
  readonly requiresSecretsTransmission?: boolean;
}
