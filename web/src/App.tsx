import { useMemo, useState } from 'react';
import type { DiscoveryRequest, DiscoveryResult } from '../../src/types/discovery';
import type { Language } from '../../src/i18n/types';
import { formatMatchReason, formatSafetyWarning, formatValidationStep } from '../../src/core/candidate-presentation';
import { renderAgentSkill, renderSolutionReport } from '../../src/exports/solution-report';

export interface AppProps {
  readonly discover?: (request: DiscoveryRequest) => Promise<DiscoveryResult>;
}

const PROVIDERS: readonly DiscoveryRequest['providers'][number][] = ['github', 'npm', 'web'];

const copy = {
  en: {
    title: 'Fixseek', subtitle: 'Evidence-first solution discovery', problem: 'Describe the problem',
    stack: 'Tech stack', constraints: 'Constraints', providers: 'Sources', search: 'Search solutions',
    plan: 'Search plan', results: 'Results', why: 'Why it fits', evidence: 'Evidence', warnings: 'Risk warnings',
    validation: 'Validation steps', select: 'Select', report: 'Download report', skill: 'Download agent skill',
    real: 'Real mode', empty: 'Describe a problem to preview the search plan.', failed: 'Discovery failed. Check provider status and retry.',
    loading: 'Searching providers…',
    stackHint: 'e.g. Node.js, Docker', constraintsHint: 'e.g. local only, MIT', noResults: 'No candidates found.',
    reranker: 'Handoff ranking', rulesOnly: 'Rules only', layaOption: 'Laya (local)', jevOption: 'Jev (TypeSafe API)',
    layaDisclosure: 'Uses a Laya server on 127.0.0.1. Problem text and excerpts remain on this computer.',
    jevDisclosure: 'Sends the problem and short source excerpts to TypeSafe AI. Requires a server-side API key.',
    handoff: 'Agent handoff', ruleScore: 'Rule score', decisionRelevance: 'Relevance', decisionCompatibility: 'Compatibility', decisionEvidence: 'Evidence probability',
  },
  zh: {
    title: 'Fixseek', subtitle: '基于证据的解决方案发现', problem: '描述你的问题',
    stack: '技术栈', constraints: '限制条件', providers: '检索来源', search: '开始检索',
    plan: '检索计划', results: '结果', why: '匹配原因', evidence: '证据', warnings: '风险提示',
    validation: '验证步骤', select: '选择', report: '下载报告', skill: '下载 Agent Skill',
    real: '真实模式', empty: '描述一个问题以预览检索计划。', failed: '检索失败，请检查来源状态后重试。',
    loading: '正在检索各来源…',
    stackHint: '例如 Node.js、Docker', constraintsHint: '例如仅本地、MIT', noResults: '未找到候选结果。',
    reranker: '交接候选排序', rulesOnly: '仅规则排序', layaOption: 'Laya（本地）', jevOption: 'Jev（TypeSafe API）',
    layaDisclosure: '使用本机 127.0.0.1 上的 Laya 服务；问题和摘录保留在本机。',
    jevDisclosure: '会将问题和简短来源摘录发送给 TypeSafe AI；需要服务端 API Key。',
    handoff: '交接给 Agent', ruleScore: '规则分数', decisionRelevance: '相关概率', decisionCompatibility: '兼容概率', decisionEvidence: '证据概率',
  },
} as const;

export function App({ discover = discoverFromGateway }: AppProps): JSX.Element {
  const [problem, setProblem] = useState('');
  const [stack, setStack] = useState('');
  const [constraints, setConstraints] = useState('');
  const [providers, setProviders] = useState<DiscoveryRequest['providers']>(['github', 'npm', 'web']);
  const [rerankerName, setRerankerName] = useState<'none' | 'jev' | 'laya'>('none');
  const [language, setLanguage] = useState<Language>('en');
  const [result, setResult] = useState<DiscoveryResult>();
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const text = copy[language];
  const plan = useMemo(() => problem.trim()
    ? providers.map((provider) => `${providerLabel(provider)} · ${problem.trim()}`)
    : [], [problem, providers]);

  async function runDiscovery(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setResult(undefined);
    setSelectedKeys([]);
    setIsLoading(true);
    try {
      const found = await discover({
        problem,
        stack: splitList(stack),
        constraints: splitList(constraints),
        providers,
        mode: 'real',
        maxResults: 10,
        ...(rerankerName === 'none' ? {} : { reranker: rerankerName }),
      });
      setResult(found);
      setSelectedKeys(found.handoff?.map((item) => item.solutionKey) ?? []);
    } catch {
      setError(text.failed);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleProvider(provider: DiscoveryRequest['providers'][number]): void {
    setProviders((current) => current.includes(provider)
      ? current.filter((item) => item !== provider)
      : [...current, provider]);
  }

  function toggleSelection(key: string): void {
    setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function download(kind: 'report' | 'skill'): void {
    if (!result) return;
    const candidates = result.candidates.filter((candidate) => selectedKeys.includes(candidate.solutionKey));
    const content = kind === 'report'
      ? renderSolutionReport({ request: result.request, candidates, language, reranking: result.reranking })
      : renderAgentSkill({ request: result.request, candidates, language, reranking: result.reranking });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    anchor.download = kind === 'report' ? 'fixseek-solution-report.md' : 'fixseek-solution-skill.md';
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  return <main className="app-shell" lang={language}>
    <header className="app-header">
      <div><h1>{text.title}</h1><p>{text.subtitle}</p></div>
      <div className="header-actions">
        <span className="mode-indicator">{text.real}</span>
        <div className="language-switcher" aria-label="Language">
          <button type="button" className={language === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')}>中文</button>
          <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
        </div>
      </div>
    </header>
    <section className="workbench">
      <form className="discovery-panel" onSubmit={(event) => void runDiscovery(event)}>
        <label htmlFor="problem">{text.problem}</label>
        <textarea id="problem" value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="Vite cannot find module after pnpm install" disabled={isLoading} />
        <label htmlFor="stack">{text.stack}</label>
        <input id="stack" value={stack} onChange={(event) => setStack(event.target.value)} placeholder={text.stackHint} disabled={isLoading} />
        <label htmlFor="constraints">{text.constraints}</label>
        <input id="constraints" value={constraints} onChange={(event) => setConstraints(event.target.value)} placeholder={text.constraintsHint} disabled={isLoading} />
        <fieldset><legend>{text.providers}</legend>
          <div className="provider-list">{PROVIDERS.map((provider) => <label key={provider}>
            <input type="checkbox" checked={providers.includes(provider)} onChange={() => toggleProvider(provider)} disabled={isLoading} />
            {providerLabel(provider)}
          </label>)}</div>
        </fieldset>
        <label htmlFor="reranker">{text.reranker}</label>
        <select id="reranker" value={rerankerName} onChange={(event) => setRerankerName(event.target.value as 'none' | 'jev' | 'laya')} disabled={isLoading}>
          <option value="none">{text.rulesOnly}</option>
          <option value="laya">{text.layaOption}</option>
          <option value="jev">{text.jevOption}</option>
        </select>
        {rerankerName !== 'none' && <p className="reranker-note">{rerankerName === 'laya' ? text.layaDisclosure : text.jevDisclosure}</p>}
        <button className="primary-action" type="submit" disabled={isLoading || !problem.trim() || providers.length === 0}>
          {isLoading ? text.loading : text.search}
        </button>
      </form>
      <section className="results-panel" aria-live="polite" aria-busy={isLoading}>
        {isLoading && <section className="loading-state" role="status"><span aria-hidden="true" />{text.loading}</section>}
        {!result && !isLoading && !error && <section className="empty-state"><h2>{text.plan}</h2>
          {plan.length === 0 ? <p>{text.empty}</p> : <ol>{plan.map((item) => <li key={item}>{item}</li>)}</ol>}
        </section>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {result && <><section className="status-strip" aria-label="Provider status">
          {result.providerStatus.map((status) => <p key={status.provider} className={`status-${status.state}`}>
            {providerLabel(status.provider)}：{providerState(status.state, language)}{status.message ? ` — ${status.message}` : ''}
          </p>)}
        </section>
        {result.request.reranker && result.reranking && <p className="rerank-status">{result.reranking.provider}: {providerState(result.reranking.state, language)}{result.reranking.message ? ` — ${result.reranking.message}` : ''}</p>}
        {result.handoff && result.handoff.length > 0 && <section className="handoff-panel"><h2>{text.handoff}</h2><ol>{result.handoff.map((item) => <li key={item.solutionKey}><a href={item.url}>{item.name}</a> · {text.ruleScore} {item.ruleScore}{item.decision ? ` · ${item.decision.provider} ${text.decisionRelevance} ${item.decision.relevanceProbability.toFixed(2)} · ${text.decisionCompatibility} ${item.decision.compatibilityProbability.toFixed(2)} · ${text.decisionEvidence} ${item.decision.evidenceProbability.toFixed(2)}` : ''}</li>)}</ol></section>}
        <div className="results-heading"><h2>{text.results}</h2><span>{result.candidates.length}</span></div>
        {result.candidates.length === 0 && <p>{text.noResults}</p>}
        {result.candidates.map((candidate) => <article className="candidate-card" key={candidate.solutionKey}>
          <div className="candidate-header"><div><p className="eyebrow">#{candidate.rank} · {candidate.candidateType}</p><h3>{candidate.name}</h3></div>
            <p className="score">{candidate.score.displayTotal}<span>/100 {text.ruleScore}</span></p></div>
          {candidate.decision && <p className="decision-probability">{candidate.decision.provider} {text.decisionRelevance}: {candidate.decision.relevanceProbability.toFixed(2)} · {text.decisionCompatibility}: {candidate.decision.compatibilityProbability.toFixed(2)} · {text.decisionEvidence}: {candidate.decision.evidenceProbability.toFixed(2)}</p>}
          <section><h4>{text.why}</h4><p>{formatMatchReason(candidate, language)}</p></section>
          <section><h4>{text.evidence}</h4><ul>{candidate.evidence.map((evidence) => <li key={evidence.sourceUrl}><a href={evidence.sourceUrl}>{evidence.title}</a>{evidence.excerpt ? ` — ${evidence.excerpt}` : ''}</li>)}</ul></section>
          {candidate.score.warnings.length > 0 && <section className="warnings"><h4>{text.warnings}</h4>{candidate.score.warnings.map((warning) => <p key={warning.message}>{warning.category}: {formatSafetyWarning(warning, language)}</p>)}</section>}
          <section><h4>{text.validation}</h4><ol>{candidate.validationSteps.map((step) => <li key={step.id}>{formatValidationStep(step, language).instruction}</li>)}</ol></section>
          <label className="select-candidate"><input type="checkbox" checked={selectedKeys.includes(candidate.solutionKey)} onChange={() => toggleSelection(candidate.solutionKey)} />{text.select} {candidate.name}</label>
        </article>)}
        <div className="export-actions"><button type="button" onClick={() => download('report')} disabled={selectedKeys.length === 0}>{text.report}</button><button type="button" onClick={() => download('skill')} disabled={selectedKeys.length === 0}>{text.skill}</button></div>
        </>}
      </section>
    </section>
  </main>;
}

function splitList(value: string): readonly string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function providerLabel(provider: DiscoveryRequest['providers'][number]): string {
  return provider === 'github' ? 'GitHub' : provider === 'npm' ? 'npm' : 'Web';
}

function providerState(state: string, language: Language): string {
  const zh: Record<string, string> = { complete: '已完成', partial: '部分成功', empty: '无结果', skipped: '已跳过', failed: '失败', pending: '等待中' };
  const en: Record<string, string> = { complete: 'complete', partial: 'partial', empty: 'empty', skipped: 'skipped', failed: 'failed', pending: 'pending' };
  return (language === 'zh' ? zh : en)[state] ?? state;
}

async function discoverFromGateway(request: DiscoveryRequest): Promise<DiscoveryResult> {
  const response = await fetch('/api/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error('Discovery failed.');
  return response.json() as Promise<DiscoveryResult>;
}
