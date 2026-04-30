import type { RankedCandidate, ScoredCandidate } from '../types/score.js';

export interface RankerOptions {
  /** Maximum number of results to return (default: 10) */
  maxResults?: number;
}

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
  const sliced = sorted.slice(0, maxResults);

  return sliced.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    matchReason: buildMatchReason(candidate),
  }));
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateByUrl(
  candidates: readonly ScoredCandidate[],
): readonly ScoredCandidate[] {
  const seen = new Map<string, ScoredCandidate>();

  for (const candidate of candidates) {
    const key = normalizeUrl(candidate.url);
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
    parts.push('README contains relevant usage examples');
  }

  if (breakdown.installationClarity === 10) {
    parts.push('clear install instructions available');
  }

  if (parts.length === 0) {
    return `Matches by general relevance (score: ${candidate.score.displayTotal})`;
  }

  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) +
    (parts.length > 1 ? '; ' + parts.slice(1).join('; ') : '') + '.';
}
