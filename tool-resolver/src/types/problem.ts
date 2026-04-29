/** Represents a fully parsed problem ready for query generation. */
export interface ParsedProblem {
  /** Raw original input string */
  readonly raw: string;

  /** Exact error tokens extracted (e.g. "reasoning_content", "ECONNREFUSED") */
  readonly errorTokens: readonly string[];

  /** Tech stack names identified (e.g. ["Claude Code", "DeepSeek", "Docker"]) */
  readonly stackNames: readonly string[];

  /** Version strings found (e.g. ["Node.js 20", "Go 1.22"]) */
  readonly versions: readonly string[];

  /** User-stated constraints (e.g. ["open source", "no cloud"]) */
  readonly constraints: readonly string[];

  /** General keywords that didn't fit other categories */
  readonly keywords: readonly string[];
}
