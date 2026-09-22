import type { RankedCandidate, ScoredCandidate, CandidateType } from '../types/score.js';

export interface RankerOptions {
  /** Maximum number of results to return (default: 10) */
  maxResults?: number;
}

/**
 * Candidates below this score are labelled "poor matches" by the presenter.
 * They may still fill otherwise empty result slots, but they do not displace a
 * stronger result merely to manufacture provider diversity.
 */
const MIN_DIVERSITY_SCORE = 10;

/**
 * Sorts, deduplicates, and ranks scored candidates.
 *
 * Tie-breaking rules (from SCORING_RULES.md):
 * 1. Higher exactErrorMatch
 * 2. Higher stackMatch
 * 3. More recent lastCommitDate
 * 4. Alphabetical by name (deterministic)
 *
 * This is a pure function: no I/O, no side effects.
 */
export function rankCandidates(
  candidates: readonly ScoredCandidate[],
  options: RankerOptions = {},
): readonly RankedCandidate[] {
  const maxResults = options.maxResults ?? 10;

  const deduped = deduplicateByUrl(candidates);
  const sorted = [...deduped].sort(compareCandidates);
  const sliced = selectSourceDiverseResults(sorted, maxResults);

  return sliced.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    matchReason: buildMatchReason(candidate),
    candidateType: resolveCandidateType(candidate),
    nextStep: buildNextStep(candidate),
  }));
}

/**
 * Reserves at most one slot for each provider's best viable candidate, ordered
 * by the normal score comparator, then fills remaining slots from the global
 * ranking. The final list is sorted normally, so diversity only changes which
 * candidates cross the result cutoff; it never rewrites score order.
 *
 * A candidate is viable for a reserved slot when it is not safety-blocked and
 * reaches the presenter's minimum weak-match score. Poor or blocked candidates
 * can still appear when spare result capacity exists.
 */
function selectSourceDiverseResults(
  sorted: readonly ScoredCandidate[],
  maxResults: number,
): readonly ScoredCandidate[] {
  if (maxResults <= 0 || sorted.length === 0) return [];

  const providerLeaders: ScoredCandidate[] = [];
  const seenProviders = new Set<string>();

  for (const candidate of sorted) {
    if (
      !seenProviders.has(candidate.provider) &&
      isViableForDiversity(candidate)
    ) {
      seenProviders.add(candidate.provider);
      providerLeaders.push(candidate);
    }
  }

  const selected = new Set(providerLeaders.slice(0, maxResults));

  for (const candidate of sorted) {
    if (selected.size >= maxResults) break;
    selected.add(candidate);
  }

  return sorted.filter((candidate) => selected.has(candidate)).slice(0, maxResults);
}

function isViableForDiversity(candidate: ScoredCandidate): boolean {
  return (
    candidate.score.trustLevel !== 'BLOCKED' &&
    candidate.score.displayTotal >= MIN_DIVERSITY_SCORE
  );
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateByUrl(
  candidates: readonly ScoredCandidate[],
): readonly ScoredCandidate[] {
  const seen = new Map<string, ScoredCandidate>();

  for (const candidate of candidates) {
    const key = normalizeUrl(candidate.provider === 'npm' ? candidate.id : candidate.url);
    const existing = seen.get(key);

    if (!existing || candidate.score.displayTotal > existing.score.displayTotal) {
      seen.set(key, candidate);
    }
  }

  return [...seen.values()];
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/$/, '').replace(/\.git$/, '');
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  // Primary: displayTotal descending
  const scoreDiff = b.score.displayTotal - a.score.displayTotal;
  if (scoreDiff !== 0) return scoreDiff;

  // Tie-break 1: exactErrorMatch descending
  const exactDiff =
    b.score.breakdown.exactErrorMatch - a.score.breakdown.exactErrorMatch;
  if (exactDiff !== 0) return exactDiff;

  // Tie-break 2: stackMatch descending
  const stackDiff = b.score.breakdown.stackMatch - a.score.breakdown.stackMatch;
  if (stackDiff !== 0) return stackDiff;

  // Tie-break 3: more recent last commit
  const aCommit = a.metadata.lastCommitDate?.getTime() ?? 0;
  const bCommit = b.metadata.lastCommitDate?.getTime() ?? 0;
  if (bCommit !== aCommit) return bCommit - aCommit;

  // Tie-break 4: alphabetical by name (deterministic)
  return a.name.localeCompare(b.name);
}

// ─── Candidate type resolution ────────────────────────────────────────────────

function resolveCandidateType(candidate: ScoredCandidate): CandidateType {
  // Use explicit hint from provider if available
  if (candidate.candidateTypeHint) return candidate.candidateTypeHint;

  // Heuristic: URL contains /issues/ → issue
  if (candidate.url.includes('/issues/')) return 'issue';

  // Heuristic: description or readme mentions workaround/env var/disable
  const text = `${candidate.description} ${candidate.readmeSnippet ?? ''}`.toLowerCase();
  if (
    text.includes('workaround') ||
    text.includes('environment variable') ||
    text.includes('disable thinking') ||
    text.includes('env var')
  ) {
    return 'workaround';
  }

  return 'tool';
}

// ─── Match reason ─────────────────────────────────────────────────────────────

function buildMatchReason(candidate: ScoredCandidate): string {
  const { breakdown } = candidate.score;
  const parts: string[] = [];

  if (breakdown.exactErrorMatch >= 15) {
    parts.push('directly references the error');
  } else if (breakdown.exactErrorMatch >= 5) {
    parts.push('mentions related error class');
  }

  if (breakdown.stackMatch >= 12) {
    parts.push('explicitly supports the tech stack');
  } else if (breakdown.stackMatch >= 5) {
    parts.push('partially matches the tech stack');
  }

  if (breakdown.readmeEvidence >= 15) {
    parts.push('source text contains a matching error');
  }

  if (breakdown.installationClarity === 10) {
    parts.push('clear install instructions available');
  }

  if (parts.length === 0) {
    return `Matches by general relevance (score: ${candidate.score.displayTotal})`;
  }

  return (
    parts[0].charAt(0).toUpperCase() +
    parts[0].slice(1) +
    (parts.length > 1 ? '; ' + parts.slice(1).join('; ') : '') +
    '.'
  );
}

// ─── Next step ────────────────────────────────────────────────────────────────

function buildNextStep(candidate: ScoredCandidate): string {
  // Use explicit hint from provider if available
  if (candidate.nextStepHint) return candidate.nextStepHint;

  const type = resolveCandidateType(candidate);

  if (type === 'issue') {
    return 'Read the issue thread for workarounds or subscribe for updates.';
  }

  if (type === 'workaround') {
    return 'Follow the workaround steps in the description, then verify with your stack.';
  }

  if (candidate.provider === 'web') {
    return `Open ${candidate.url} and verify the source claim against your stack.`;
  }
  return `Review the documentation at ${candidate.url} and propose an isolated validation before installation.`;
}
