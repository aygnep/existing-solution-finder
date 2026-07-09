import type { SolutionCandidate } from '../types/discovery.js';
import type { RankedCandidate } from '../types/score.js';

export function groupSolutions(
  candidates: readonly RankedCandidate[],
  retrievedAt: Date,
): readonly SolutionCandidate[] {
  const groups = new Map<string, RankedCandidate[]>();

  for (const candidate of candidates) {
    const key = normalizeSolutionKey(candidate.metadata.repositoryUrl ?? candidate.url);
    const members = groups.get(key) ?? [];
    members.push(candidate);
    groups.set(key, members);
  }

  return [...groups.entries()].map(([solutionKey, members]) => {
    const ordered = [...members].sort((left, right) => left.rank - right.rank);
    const primary = ordered[0]!;
    return {
      ...primary,
      solutionKey,
      evidence: ordered.map((candidate) => ({
        sourceUrl: candidate.url,
        sourceKind: candidate.provider,
        title: candidate.name,
        excerpt: candidate.readmeSnippet ?? candidate.description,
        retrievedAt: retrievedAt.toISOString(),
      })),
      relatedCandidates: ordered,
      validationSteps: [],
    };
  });
}

function normalizeSolutionKey(url: string): string {
  return url.toLowerCase().replace(/\/$/, '').replace(/\.git$/, '');
}
