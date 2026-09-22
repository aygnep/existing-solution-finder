import type { SolutionCandidate } from '../types/discovery.js';
import type { RankedCandidate } from '../types/score.js';
import type { ScoredCandidate } from '../types/score.js';
import { createValidationSteps } from './validation-guidance.js';

export function groupSolutions(
  candidates: readonly RankedCandidate[],
  retrievedAt: Date,
  sourceCandidates: readonly ScoredCandidate[] = candidates,
): readonly SolutionCandidate[] {
  const groups = new Map<string, ScoredCandidate[]>();

  for (const candidate of sourceCandidates) {
    const key = solutionKeyFor(candidate);
    const members = groups.get(key) ?? [];
    members.push(candidate);
    groups.set(key, members);
  }

  const selectedKeys = new Set<string>();
  return candidates.filter((candidate) => {
    const key = solutionKeyFor(candidate);
    if (selectedKeys.has(key)) return false;
    selectedKeys.add(key);
    return true;
  }).map((primary) => {
    const solutionKey = solutionKeyFor(primary);
    const members = groups.get(solutionKey) ?? [primary];
    const evidenceBySource = new Map<string, ScoredCandidate>();
    for (const member of members) {
      evidenceBySource.set(`${member.provider}:${member.url.toLowerCase()}`, member);
    }
    return {
      ...primary,
      solutionKey,
      evidence: [...evidenceBySource.values()].map((candidate) => ({
        sourceUrl: candidate.url,
        sourceKind: candidate.provider,
        title: candidate.name,
        excerpt: candidate.readmeSnippet || candidate.description,
        retrievedAt: retrievedAt.toISOString(),
      })),
      relatedCandidates: members,
      validationSteps: createValidationSteps(primary),
    };
  });
}

export function solutionKeyFor(candidate: ScoredCandidate): string {
  if (candidate.provider === 'npm') {
    return normalizeSolutionKey(candidate.providerEvidence?.registryUrl ?? candidate.id);
  }
  return normalizeSolutionKey(candidate.metadata.repositoryUrl ?? candidate.url);
}

function normalizeSolutionKey(url: string): string {
  return url.toLowerCase().replace(/\/$/, '').replace(/\.git$/, '');
}
