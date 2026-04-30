import type { ParsedProblem } from '../types/problem.js';
import type { RankedCandidate } from '../types/score.js';

const SCORE_LABELS: Record<string, string> = {
  HIGH: '🟢 Strong Match',
  MEDIUM: '🟡 Possible Match',
  LOW: '🟠 Weak Match',
  POOR: '🔴 Poor Match',
};

const TRUST_ICONS: Record<string, string> = {
  HIGH: '✅ Trusted',
  MEDIUM: '🔶 Unverified',
  LOW: '⚠️  Caution',
  BLOCKED: '🚫 Risky',
};

const TYPE_LABELS: Record<string, string> = {
  tool: '🔧 Tool',
  issue: '🐛 Issue',
  workaround: '💡 Workaround',
};

/**
 * Formats the ranked results into a human-readable CLI string.
 *
 * This is a pure function: no I/O, no side effects.
 */
export function summarize(
  candidates: readonly RankedCandidate[],
  problem: ParsedProblem,
): string {
  if (candidates.length === 0) {
    return [
      '═'.repeat(60),
      '  No candidates found.',
      '',
      '  Try rephrasing your problem with more specific error messages',
      '  or tool names.',
      '═'.repeat(60),
    ].join('\n');
  }

  const lines: string[] = [
    '',
    '═'.repeat(60),
    `  Tool Resolver — Results for your problem`,
    '─'.repeat(60),
    `  Problem: ${truncate(problem.raw, 80)}`,
    problem.stackNames.length > 0
      ? `  Stack:   ${problem.stackNames.join(', ')}`
      : '',
    problem.errorTokens.length > 0
      ? `  Errors:  ${problem.errorTokens.slice(0, 3).join(', ')}`
      : '',
    '═'.repeat(60),
    '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    lines.push(...formatCandidate(candidate));
    lines.push('');
  }

  lines.push('─'.repeat(60));
  lines.push(`  ${candidates.length} result(s) found.`);
  lines.push('═'.repeat(60));
  lines.push('');

  return lines.join('\n');
}

// ─── Candidate formatter ──────────────────────────────────────────────────────

function formatCandidate(candidate: RankedCandidate): string[] {
  const lines: string[] = [];
  const scoreLabel = getScoreLabel(candidate.score.displayTotal);
  const trustLabel = TRUST_ICONS[candidate.score.trustLevel] ?? '';
  const typeLabel = TYPE_LABELS[candidate.candidateType] ?? candidate.candidateType;

  // Header
  lines.push(
    `  [${candidate.rank}] ${candidate.name}`,
    `      ${candidate.url}`,
    `      Type: ${typeLabel}  |  Score: ${candidate.score.displayTotal}/100  ${scoreLabel}  |  ${trustLabel}`,
    '',
    `      Why: ${candidate.matchReason}`,
  );

  if (candidate.description) {
    lines.push(`      Desc: ${truncate(candidate.description, 100)}`);
  }

  // Warnings
  if (candidate.score.warnings.length > 0) {
    lines.push('');
    for (const warning of candidate.score.warnings) {
      lines.push(`      ⚠️  WARNING [${warning.category}]: ${warning.message}`);
    }
  }

  // Score breakdown (compact)
  lines.push('');
  lines.push('      Score breakdown:');
  const b = candidate.score.breakdown;
  lines.push(
    `        Error match: ${b.exactErrorMatch}/25  ` +
    `Stack: ${b.stackMatch}/20  ` +
    `README: ${b.readmeEvidence}/15`,
  );
  lines.push(
    `        Recency: ${b.recency}/10  ` +
    `Install: ${b.installationClarity}/10  ` +
    `Activity: ${b.maintenanceActivity}/10  ` +
    `Config: ${b.exampleConfig}/10`,
  );

  if (candidate.score.penalties.length > 0) {
    const penaltyStr = candidate.score.penalties
      .map((p) => `${p.reason} (${p.amount})`)
      .join(', ');
    lines.push(`        Penalties: ${penaltyStr}`);
  }

  // Next step — always shown
  lines.push('');
  lines.push(`      ▶  Next step: ${candidate.nextStep}`);

  lines.push('      ' + '─'.repeat(54));

  return lines;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreLabel(score: number): string {
  if (score >= 70) return SCORE_LABELS['HIGH'] ?? '';
  if (score >= 40) return SCORE_LABELS['MEDIUM'] ?? '';
  if (score >= 10) return SCORE_LABELS['LOW'] ?? '';
  return SCORE_LABELS['POOR'] ?? '';
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}
