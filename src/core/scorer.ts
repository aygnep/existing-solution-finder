import type { RawCandidate } from '../types/candidate.js';
import type { ParsedProblem } from '../types/problem.js';
import type {
  Penalty,
  SafetyWarning,
  Score,
  ScoreBreakdown,
  ScoredCandidate,
  TrustLevel,
} from '../types/score.js';

/** 12 months in milliseconds */
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Scores a single candidate against the given problem.
 *
 * Rules are defined in docs/SCORING_RULES.md.
 * This is a pure function: no I/O, no side effects.
 */
export function scoreCandidate(
  candidate: RawCandidate,
  problem: ParsedProblem,
): Score {
  const breakdown = computeBreakdown(candidate, problem);
  const penalties = computePenalties(candidate);
  const subtotal = sumBreakdown(breakdown);
  const penaltyTotal = penalties.reduce((sum, p) => sum + p.amount, 0);
  const total = subtotal + penaltyTotal;
  const displayTotal = Math.max(0, total);
  const warnings = buildWarnings(candidate, penalties);
  const trustLevel = determineTrustLevel(candidate, displayTotal);

  return { breakdown, penalties, subtotal, total, displayTotal, trustLevel, warnings };
}

/**
 * Scores a candidate and returns a ScoredCandidate.
 * Convenience wrapper around scoreCandidate.
 */
export function scoreAndAttach(
  candidate: RawCandidate,
  problem: ParsedProblem,
): ScoredCandidate {
  return { ...candidate, score: scoreCandidate(candidate, problem) };
}

// ─── Breakdown computation ────────────────────────────────────────────────────

function computeBreakdown(candidate: RawCandidate, problem: ParsedProblem): ScoreBreakdown {
  return {
    exactErrorMatch: scoreExactErrorMatch(candidate, problem),
    stackMatch: scoreStackMatch(candidate, problem),
    readmeEvidence: scoreReadmeEvidence(candidate, problem),
    recency: scoreRecency(candidate),
    installationClarity: scoreInstallClarity(candidate),
    maintenanceActivity: scoreMaintenanceActivity(candidate),
    exampleConfig: scoreExampleConfig(candidate),
  };
}

function scoreExactErrorMatch(candidate: RawCandidate, problem: ParsedProblem): number {
  const searchable = [
    candidate.name,
    candidate.description,
    candidate.readmeSnippet ?? '',
  ]
    .join(' ')
    .toLowerCase();

  const matchedInReadme = problem.errorTokens.filter((t) =>
    (candidate.readmeSnippet ?? '').toLowerCase().includes(t.toLowerCase()),
  );

  const matchedInTitle = problem.errorTokens.filter((t) =>
    [candidate.name, candidate.description].join(' ').toLowerCase().includes(t.toLowerCase()),
  );

  if (matchedInTitle.length > 0) return 25;
  if (matchedInReadme.length > 0) return 15;

  // Partial match — error class keyword found
  const hasRelatedKeyword = problem.keywords.some((k) => searchable.includes(k.toLowerCase()));
  if (hasRelatedKeyword) return 5;

  return 0;
}

function scoreStackMatch(candidate: RawCandidate, problem: ParsedProblem): number {
  const searchable = [candidate.name, candidate.description, candidate.readmeSnippet ?? '']
    .join(' ')
    .toLowerCase();

  const matched = problem.stackNames.filter((tool) =>
    searchable.includes(tool.toLowerCase()),
  );

  if (problem.stackNames.length === 0) return 10; // no stack context; neutral

  const ratio = matched.length / problem.stackNames.length;
  if (ratio >= 1.0) return 20;
  if (ratio >= 0.5) return 12;
  if (ratio > 0) return 5;
  return 0;
}

function scoreReadmeEvidence(candidate: RawCandidate, problem: ParsedProblem): number {
  const readme = candidate.readmeSnippet ?? '';
  if (!readme || readme.length < 50) return 0;

  const readmeLower = readme.toLowerCase();
  const matchCount = problem.errorTokens.filter((t) =>
    readmeLower.includes(t.toLowerCase()),
  ).length;

  if (matchCount > 0) return 15;

  // General usage section present
  if (readmeLower.includes('usage') || readmeLower.includes('install')) return 8;

  return 0;
}

function scoreRecency(candidate: RawCandidate): number {
  const lastCommit = candidate.metadata.lastCommitDate;
  if (!lastCommit) return 3; // unknown; give benefit of doubt

  const ageMs = Date.now() - lastCommit.getTime();
  if (ageMs < THREE_MONTHS_MS) return 10;
  if (ageMs < TWELVE_MONTHS_MS) return 7;
  if (ageMs < TWO_YEARS_MS) return 3;
  return 0;
}

function scoreInstallClarity(candidate: RawCandidate): number {
  if (candidate.metadata.hasInstallInstructions === true) return 10;
  if (candidate.metadata.hasInstallInstructions === false) return 0;

  // Heuristic from readme snippet
  const readme = candidate.readmeSnippet?.toLowerCase() ?? '';
  const hasInstall =
    readme.includes('npm install') ||
    readme.includes('pip install') ||
    readme.includes('go install') ||
    readme.includes('brew install') ||
    readme.includes('cargo install');

  return hasInstall ? 10 : 5;
}

function scoreMaintenanceActivity(candidate: RawCandidate): number {
  const lastCommit = candidate.metadata.lastCommitDate;
  if (!lastCommit) return 3;

  const ageMs = Date.now() - lastCommit.getTime();
  const openIssues = candidate.metadata.openIssueCount ?? 0;

  if (ageMs < THREE_MONTHS_MS && openIssues < 50) return 10;
  if (ageMs < SIX_MONTHS_MS) return 5;
  return 0;
}

function scoreExampleConfig(candidate: RawCandidate): number {
  if (candidate.metadata.hasExampleConfig === true) return 10;
  if (candidate.metadata.hasExampleConfig === false) return 0;

  // Heuristic from readme
  const readme = candidate.readmeSnippet?.toLowerCase() ?? '';
  const hasExample =
    readme.includes('example') ||
    readme.includes('config') ||
    readme.includes('```');

  return hasExample ? 5 : 0;
}

// ─── Penalties ────────────────────────────────────────────────────────────────

function computePenalties(candidate: RawCandidate): readonly Penalty[] {
  const penalties: Penalty[] = [];
  const { metadata } = candidate;

  if (!candidate.readmeSnippet || candidate.readmeSnippet.length < 20) {
    penalties.push({ amount: -10, reason: 'No README' });
  }

  if (!metadata.license) {
    penalties.push({ amount: -5, reason: 'No license file' });
  }

  if (metadata.isArchived === true) {
    penalties.push({ amount: -30, reason: 'Archived repository' });
  }

  if (metadata.hasSuspiciousInstallScript === true) {
    penalties.push({ amount: -30, reason: 'Suspicious install script (curl|bash without checksum)' });
  }

  if (metadata.requiresSecretsTransmission === true) {
    penalties.push({ amount: -30, reason: 'Requires sending secrets to unknown server' });
  }

  if (metadata.lastCommitDate) {
    const ageMs = Date.now() - metadata.lastCommitDate.getTime();
    if (ageMs > THREE_YEARS_MS) {
      penalties.push({ amount: -15, reason: 'Last commit > 3 years ago' });
    }
  }

  return penalties;
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

function buildWarnings(
  candidate: RawCandidate,
  penalties: readonly Penalty[],
): readonly SafetyWarning[] {
  const warnings: SafetyWarning[] = [];
  const { metadata } = candidate;

  // Warnings from penalties
  for (const penalty of penalties) {
    warnings.push({ category: 'PENALTY', message: penalty.reason });
  }

  // Additional safety warnings (not penalties, just informational)
  const stars = metadata.stars ?? 0;
  const ageMonths = metadata.createdDate
    ? (Date.now() - metadata.createdDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
    : null;

  if (ageMonths !== null && ageMonths < 6 && stars < 100) {
    warnings.push({
      category: 'NEW_PROJECT',
      message: `Created ${Math.round(ageMonths)} months ago with only ${stars} stars. Not widely tested.`,
    });
  } else if (stars < 50 && metadata.ownerType === 'user') {
    warnings.push({
      category: 'LOW_STARS',
      message: `Only ${stars} stars. May be experimental or unmaintained.`,
    });
  }

  return warnings;
}

// ─── Trust level ──────────────────────────────────────────────────────────────

function determineTrustLevel(candidate: RawCandidate, displayTotal: number): TrustLevel {
  const { metadata } = candidate;

  if (
    metadata.isArchived ||
    metadata.hasSuspiciousInstallScript ||
    metadata.requiresSecretsTransmission
  ) {
    return 'BLOCKED';
  }

  if (metadata.ownerType === 'organization' && displayTotal >= 60 && metadata.license) {
    return 'HIGH';
  }

  if (displayTotal >= 40 && metadata.license) {
    return 'MEDIUM';
  }

  return 'LOW';
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sumBreakdown(breakdown: ScoreBreakdown): number {
  return (
    breakdown.exactErrorMatch +
    breakdown.stackMatch +
    breakdown.readmeEvidence +
    breakdown.recency +
    breakdown.installationClarity +
    breakdown.maintenanceActivity +
    breakdown.exampleConfig
  );
}
