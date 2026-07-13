import type { DiscoveryRequest, SolutionCandidate } from '../types/discovery.js';
import { formatMatchReason, formatSafetyWarning, formatValidationStep } from '../core/candidate-presentation.js';
import type { Language } from '../i18n/types.js';

export interface SolutionExportInput {
  readonly request: DiscoveryRequest;
  readonly candidates: readonly SolutionCandidate[];
  readonly language?: Language;
}

export function renderSolutionReport(input: SolutionExportInput): string {
  const language = input.language ?? 'en';
  const labels = language === 'zh'
    ? { title: '# Fixseek 解决方案报告', problem: '问题', sources: '来源', score: '评分', why: '匹配原因', evidence: '证据', warnings: '风险提示', validation: '验证步骤' }
    : { title: '# Fixseek Solution Report', problem: 'Problem', sources: 'Sources', score: 'Score', why: 'Why', evidence: 'Evidence', warnings: 'Safety warnings', validation: 'Validation' };
  const lines = [
    labels.title,
    '',
    `## ${labels.problem}\n${input.request.problem}`,
    '',
    `## ${labels.sources}\n${input.request.providers.join(', ') || 'None'}`,
  ];

  for (const candidate of input.candidates) {
    lines.push(
      '',
      `## ${candidate.name}`,
      `- ${labels.score}: ${candidate.score.displayTotal}/100 (${candidate.score.trustLevel})`,
      `- ${labels.why}: ${formatMatchReason(candidate, language)}`,
      `- ${labels.evidence}:`,
      ...candidate.evidence.map((evidence) => `  - ${evidence.sourceUrl}${evidence.excerpt ? ` — ${evidence.excerpt}` : ''}`),
    );
    if (candidate.score.warnings.length > 0) {
      lines.push(`- ${labels.warnings}:`, ...candidate.score.warnings.map((warning) => `  - ${warning.category}: ${formatSafetyWarning(warning, language)}`));
    }
    lines.push(`- ${labels.validation}:`, ...candidate.validationSteps.map((step) => `  - ${formatValidationStep(step, language).instruction}`));
  }

  return lines.join('\n') + '\n';
}

export function renderAgentSkill(input: SolutionExportInput): string {
  const report = renderSolutionReport(input);
  return [
    '---',
    'name: fixseek-solution-guide',
    'description: Apply a reviewed Fixseek solution report safely.',
    '---',
    '',
    '## Safety',
    'Never install or execute a candidate automatically.',
    '',
    '## Evidence',
    report,
    '## Validation',
    'Review the listed evidence, warnings, and validation steps before taking any action.',
    '',
  ].join('\n');
}
