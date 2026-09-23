import type { DiscoveryRequest, RerankingStatus, SolutionCandidate } from '../types/discovery.js';
import { formatMatchReason, formatSafetyWarning, formatValidationStep } from '../core/candidate-presentation.js';
import type { Language } from '../i18n/types.js';

export interface SolutionExportInput {
  readonly request: DiscoveryRequest;
  readonly candidates: readonly SolutionCandidate[];
  readonly language?: Language;
  readonly reranking?: RerankingStatus;
}

export function renderSolutionReport(input: SolutionExportInput): string {
  const language = input.language ?? 'en';
  const labels = language === 'zh'
    ? { title: '# Fixseek 解决方案报告', problem: '问题', sources: '来源', score: '规则分数', why: '匹配原因', evidence: '证据', warnings: '风险提示', validation: '验证步骤', reranking: '重排', relevance: '相关概率', compatibility: '兼容概率', evidenceProbability: '证据概率' }
    : { title: '# Fixseek Solution Report', problem: 'Problem', sources: 'Sources', score: 'Rule score', why: 'Why', evidence: 'Evidence', warnings: 'Safety warnings', validation: 'Validation', reranking: 'Reranking', relevance: 'Relevance probability', compatibility: 'Compatibility probability', evidenceProbability: 'Evidence probability' };
  const lines = [
    labels.title,
    '',
    `## ${labels.problem}\n${input.request.problem}`,
    '',
    `## ${labels.sources}\n${input.request.providers.join(', ') || 'None'}`,
  ];
  if (input.request.reranker && input.reranking) {
    lines.push('', `${input.reranking.provider} ${labels.reranking}: ${input.reranking.state}${input.reranking.model ? ` (${input.reranking.model})` : ''}`);
  }

  for (const candidate of input.candidates) {
    lines.push(
      '',
      `## ${candidate.name}`,
      `- ${labels.score}: ${candidate.score.displayTotal}/100 (${candidate.score.trustLevel})`,
      ...(candidate.decision ? [`- ${candidate.decision.provider} ${labels.relevance}: ${candidate.decision.relevanceProbability.toFixed(3)}; ${labels.compatibility}: ${candidate.decision.compatibilityProbability.toFixed(3)}; ${labels.evidenceProbability}: ${candidate.decision.evidenceProbability.toFixed(3)}`] : []),
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
