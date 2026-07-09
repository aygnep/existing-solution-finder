import type { DiscoveryRequest, SolutionCandidate } from '../types/discovery.js';

export interface SolutionExportInput {
  readonly request: DiscoveryRequest;
  readonly candidates: readonly SolutionCandidate[];
}

export function renderSolutionReport(input: SolutionExportInput): string {
  const lines = [
    '# Fixseek Solution Report',
    '',
    `## Problem\n${input.request.problem}`,
    '',
    `## Sources\n${input.request.providers.join(', ') || 'None'}`,
  ];

  for (const candidate of input.candidates) {
    lines.push(
      '',
      `## ${candidate.name}`,
      `- Score: ${candidate.score.displayTotal}/100 (${candidate.score.trustLevel})`,
      `- Why: ${candidate.matchReason}`,
      '- Evidence:',
      ...candidate.evidence.map((evidence) => `  - ${evidence.sourceUrl}${evidence.excerpt ? ` — ${evidence.excerpt}` : ''}`),
    );
    if (candidate.score.warnings.length > 0) {
      lines.push('- Safety warnings:', ...candidate.score.warnings.map((warning) => `  - ${warning.category}: ${warning.message}`));
    }
    lines.push('- Validation:', ...candidate.validationSteps.map((step) => `  - ${step.instruction}`));
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
