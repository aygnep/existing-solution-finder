import type { ValidationStep } from '../types/discovery.js';
import type { RankedCandidate, SafetyWarning } from '../types/score.js';
import type { Language } from '../i18n/types.js';

export function formatMatchReason(candidate: RankedCandidate, language: Language): string {
  const { breakdown } = candidate.score;
  const clauses: string[] = [];
  const zh = language === 'zh';

  if (breakdown.exactErrorMatch >= 15) clauses.push(zh ? '直接提及该错误' : 'Directly references the error');
  else if (breakdown.exactErrorMatch >= 5) clauses.push(zh ? '提及相关错误类型' : 'Mentions related error class');
  if (breakdown.stackMatch >= 12) clauses.push(zh ? '明确支持该技术栈' : 'Explicitly supports the tech stack');
  else if (breakdown.stackMatch >= 5) clauses.push(zh ? '部分匹配该技术栈' : 'Partially matches the tech stack');
  if (breakdown.readmeEvidence >= 15) clauses.push(zh ? 'README 包含相关使用示例' : 'README contains relevant usage examples');
  if (breakdown.installationClarity === 10) clauses.push(zh ? '提供清晰的安装说明' : 'Clear install instructions available');
  if (clauses.length === 0) return zh
    ? `基于整体相关性匹配（评分：${candidate.score.displayTotal}）`
    : `Matches by general relevance (score: ${candidate.score.displayTotal})`;
  return zh ? `${clauses.join('；')}。` : `${clauses.join('; ')}.`;
}

export function formatNextStep(candidate: RankedCandidate, language: Language): string {
  const zh = language === 'zh';
  if (candidate.candidateType === 'issue') return zh
    ? '阅读 issue 讨论，确认可用的变通方案或订阅后续更新。'
    : 'Read the issue thread for workarounds or subscribe for updates.';
  if (candidate.candidateType === 'workaround') return zh
    ? '按照说明中的变通步骤操作，再结合你的技术栈进行验证。'
    : 'Follow the workaround steps in the description, then verify with your stack.';
  return zh
    ? `查看 ${candidate.url} 中的 README，并在隔离环境验证文档步骤。`
    : `Review the README at ${candidate.url} and verify the documented steps in an isolated environment.`;
}

export function formatSafetyWarning(warning: SafetyWarning, language: Language): string {
  if (language === 'en') return warning.message;
  if (warning.code === 'low-stars') return `仅有 ${warning.params?.stars ?? ''} 个星标，项目可能仍处于实验或维护不足状态。`;
  if (warning.code === 'new-project') return `项目创建于 ${warning.params?.createdMonths ?? ''} 个月前，仅有 ${warning.params?.stars ?? ''} 个星标，尚未得到充分验证。`;
  if (warning.code === 'penalty') return `风险提示：${warning.message}`;
  return warning.message;
}

export function formatValidationStep(step: ValidationStep, language: Language): ValidationStep {
  if (language === 'en') return step;
  if (step.id === 'review-risk') return {
    ...step,
    instruction: '在考虑此候选项前，请阅读链接来源和已展示的风险提示。',
    expectedObservation: '你能够识别归档、脚本或密钥传输风险。',
    riskNote: '该候选项被 Fixseek 安全规则标记为高风险；请勿执行其安装命令。',
  };
  if (step.id === 'review-evidence') return { ...step, instruction: '打开引用来源，确认其中的证据适用于你的技术栈。', expectedObservation: '来源明确提及相关工具、错误或兼容性条件。' };
  if (step.id === 'check-compatibility') return { ...step, instruction: '检查许可证、支持版本和配置示例。', expectedObservation: '你的约束得到支持，或已明确理解差距。' };
  if (step.id === 'try-isolated') return { ...step, instruction: '如果决定继续，请先在隔离环境测试文档中的设置。', expectedObservation: '预期行为出现，且不需要生产环境密钥。' };
  return step;
}
