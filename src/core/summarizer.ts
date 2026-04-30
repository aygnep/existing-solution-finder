import type { ParsedProblem } from '../types/problem.js';
import type { RankedCandidate } from '../types/score.js';
import { t } from '../i18n/messages.js';
import type { Language } from '../i18n/types.js';

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

export interface SummarizeOptions {
  readonly lang?: Language;
}

/**
 * Formats the ranked results into a human-readable CLI string.
 *
 * This is a pure function: no I/O, no side effects.
 */
export function summarize(
  candidates: readonly RankedCandidate[],
  problem: ParsedProblem,
  options: SummarizeOptions = {},
): string {
  const lang = options.lang ?? 'en';

  if (candidates.length === 0) {
    return [
      '═'.repeat(60),
      `  ${t(lang, 'noResultsFound')}.`,
      '',
      '  Try rephrasing your problem with more specific error messages',
      '  or tool names.',
      '═'.repeat(60),
    ].join('\n');
  }

  const lines: string[] = [
    '',
    '═'.repeat(60),
    `  Tool Resolver — ${t(lang, 'topMatches')}`,
    '─'.repeat(60),
    `  ${t(lang, 'problem')}: ${truncate(problem.raw, 80)}`,
    problem.stackNames.length > 0
      ? `  ${t(lang, 'stack')}:   ${problem.stackNames.join(', ')}`
      : '',
    problem.errorTokens.length > 0
      ? `  ${t(lang, 'errors')}:  ${problem.errorTokens.slice(0, 3).join(', ')}`
      : '',
    '═'.repeat(60),
    '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    lines.push(...formatCandidate(candidate, lang));
    lines.push('');
  }

  lines.push('─'.repeat(60));
  lines.push(`  ${candidates.length} ${t(lang, 'resultsFound')}.`);
  lines.push('═'.repeat(60));
  lines.push('');

  return lines.join('\n');
}

// ─── Candidate formatter ──────────────────────────────────────────────────────

function formatCandidate(candidate: RankedCandidate, lang: Language): string[] {
  const lines: string[] = [];
  const scoreLabel = getScoreLabel(candidate.score.displayTotal);
  const trustLabel = TRUST_ICONS[candidate.score.trustLevel] ?? '';
  const typeLabel = getTypeLabel(candidate.candidateType, lang);

  // Header
  lines.push(
    `  [${candidate.rank}] ${candidate.name}`,
    `      ${candidate.url}`,
    `      ${t(lang, 'type')}: ${typeLabel}  |  ${t(lang, 'fitScore')}: ${candidate.score.displayTotal}/100  ${scoreLabel}  |  ${trustLabel}`,
    '',
    `      ${t(lang, 'why')}: ${candidate.matchReason}`,
  );

  if (candidate.description) {
    lines.push(`      ${t(lang, 'desc')}: ${truncate(candidate.description, 100)}`);
  }

  // Warnings
  if (candidate.score.warnings.length > 0) {
    lines.push('');
    for (const warning of candidate.score.warnings) {
      lines.push(`      ⚠️  ${t(lang, 'warning')} [${warning.category}]: ${warning.message}`);
    }
  }

  // Score breakdown (compact)
  lines.push('');
  lines.push(`      ${t(lang, 'scoreBreakdown')}:`);
  const b = candidate.score.breakdown;
  lines.push(
    `        ${t(lang, 'errorMatch')}: ${b.exactErrorMatch}/25  ` +
    `${t(lang, 'stack')}: ${b.stackMatch}/20  ` +
    `${t(lang, 'readme')}: ${b.readmeEvidence}/15`,
  );
  lines.push(
    `        ${t(lang, 'recency')}: ${b.recency}/10  ` +
    `${t(lang, 'install')}: ${b.installationClarity}/10  ` +
    `${t(lang, 'activity')}: ${b.maintenanceActivity}/10  ` +
    `${t(lang, 'config')}: ${b.exampleConfig}/10`,
  );

  if (candidate.score.penalties.length > 0) {
    const penaltyStr = candidate.score.penalties
      .map((p) => `${p.reason} (${p.amount})`)
      .join(', ');
    lines.push(`        ${t(lang, 'penalties')}: ${penaltyStr}`);
  }

  // Next step — always shown
  lines.push('');
  lines.push(`      ▶  ${t(lang, 'nextSteps')}: ${candidate.nextStep}`);

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

function getTypeLabel(candidateType: string, lang: Language): string {
  if (lang === 'en') {
    return TYPE_LABELS[candidateType] ?? candidateType;
  }

  if (candidateType === 'tool') return `🔧 ${t(lang, 'tool')}`;
  if (candidateType === 'issue') return `🐛 ${t(lang, 'issue')}`;
  if (candidateType === 'workaround') return `💡 ${t(lang, 'workaround')}`;
  return candidateType;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}
