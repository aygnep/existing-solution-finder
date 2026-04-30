import type { Language, MessageKey, Messages } from './types.js';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'zh'];

export const messages: Record<Language, Messages> = {
  en: {
    activity: 'Activity',
    candidate: 'Candidate',
    config: 'Config',
    desc: 'Desc',
    error: 'Error',
    errorMatch: 'Error match',
    errors: 'Errors',
    fitScore: 'Fit score',
    inputRequired: 'Input required',
    install: 'Install',
    issue: 'Issue',
    missingGithubToken: 'Missing GITHUB_TOKEN',
    mockMode: 'Mock mode',
    nextSteps: 'Next steps',
    noResultsFound: 'No results found',
    penalties: 'Penalties',
    problem: 'Problem',
    provider: 'Provider',
    readme: 'README',
    readingFromStdin: 'Reading from stdin',
    realMode: 'Real mode',
    recommendedAction: 'Recommended action',
    recency: 'Recency',
    resultsFound: 'result(s) found',
    risks: 'Risks',
    scoreBreakdown: 'Score breakdown',
    searchQueries: 'Search queries',
    stack: 'Stack',
    topMatches: 'Top matches',
    tool: 'Tool',
    type: 'Type',
    unknown: 'Unknown',
    unsupportedLanguage: 'Unsupported language',
    unsupportedProvider: 'Unsupported provider',
    warning: 'Warning',
    why: 'Why',
    workaround: 'Workaround',
  },
  zh: {
    activity: '活跃度',
    candidate: '候选结果',
    config: '配置',
    desc: '描述',
    error: '错误',
    errorMatch: '错误匹配',
    errors: '错误',
    fitScore: '匹配分',
    inputRequired: '需要输入',
    install: '安装',
    issue: 'Issue',
    missingGithubToken: '缺少 GITHUB_TOKEN',
    mockMode: 'Mock 模式',
    nextSteps: '下一步',
    noResultsFound: '未找到结果',
    penalties: '扣分项',
    problem: '问题',
    provider: 'Provider',
    readme: 'README',
    readingFromStdin: '正在从 stdin 读取',
    realMode: 'Real 模式',
    recommendedAction: '建议操作',
    recency: '近期更新',
    resultsFound: '个结果',
    risks: '风险',
    scoreBreakdown: '评分明细',
    searchQueries: '搜索查询',
    stack: '技术栈',
    topMatches: '最佳匹配',
    tool: '工具',
    type: '类型',
    unknown: '未知',
    unsupportedLanguage: '不支持的语言',
    unsupportedProvider: '不支持的 provider',
    warning: '警告',
    why: '匹配原因',
    workaround: 'Workaround',
  },
};

export function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function parseLanguage(value: string | undefined): Language {
  const language = value ?? 'en';
  if (isLanguage(language)) return language;

  throw new Error(
    `Unsupported language: ${language}. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}.`,
  );
}

export function t(language: Language, key: MessageKey): string {
  return messages[language][key];
}
