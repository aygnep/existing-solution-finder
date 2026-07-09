import { useMemo, useState } from 'react';
import type { DiscoveryRequest, DiscoveryResult } from '../../src/types/discovery';
import { renderAgentSkill, renderSolutionReport } from '../../src/exports/solution-report';

export interface AppProps {
  readonly discover?: (request: DiscoveryRequest) => Promise<DiscoveryResult>;
}

export function App({ discover = discoverFromGateway }: AppProps): JSX.Element {
  const [problem, setProblem] = useState('');
  const [providers, setProviders] = useState<DiscoveryRequest['providers']>(['github', 'npm', 'web']);
  const [planVisible, setPlanVisible] = useState(false);
  const [result, setResult] = useState<DiscoveryResult>();
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const [error, setError] = useState<string>();
  const plan = useMemo(() => problem.trim() ? [`Search GitHub for ${problem.trim()}`, `Search npm for ${problem.trim()}`, `Search public web sources for ${problem.trim()}`] : [], [problem]);

  function toggleProvider(provider: DiscoveryRequest['providers'][number]): void {
    setProviders((current) => current.includes(provider)
      ? current.filter((item) => item !== provider)
      : [...current, provider]);
  }

  async function runDiscovery(): Promise<void> {
    setError(undefined);
    try {
      setResult(await discover({ problem, stack: [], constraints: [], providers, mode: 'mock', maxResults: 10 }));
      setSelectedKeys([]);
    } catch {
      setError('Discovery failed. Check provider status and retry.');
    }
  }

  function toggleSelection(key: string): void {
    setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function download(kind: 'report' | 'skill'): void {
    if (!result) return;
    const candidates = result.candidates.filter((candidate) => selectedKeys.includes(candidate.solutionKey));
    const content = kind === 'report'
      ? renderSolutionReport({ request: result.request, candidates })
      : renderAgentSkill({ request: result.request, candidates });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    anchor.download = kind === 'report' ? 'fixseek-solution-report.md' : 'fixseek-solution-skill.md';
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  return <main>
    <h1>Fixseek Solution Guide</h1>
    <label htmlFor="problem">Describe the problem</label>
    <textarea id="problem" value={problem} onChange={(event) => setProblem(event.target.value)} />
    <button type="button" onClick={() => setPlanVisible(true)} disabled={!problem.trim()}>Create search plan</button>
    {planVisible && <section>
      <h2>Search plan</h2>
      {(['github', 'npm', 'web'] as const).map((provider) => <label key={provider}>
        <input type="checkbox" checked={providers.includes(provider)} onChange={() => toggleProvider(provider)} />
        {provider === 'github' ? 'GitHub' : provider === 'npm' ? 'npm' : 'Web'}
      </label>)}
      <ul>{plan.map((item) => <li key={item}>{item}</li>)}</ul>
      <button type="button" onClick={() => void runDiscovery()} disabled={providers.length === 0}>Run discovery</button>
    </section>}
    {error && <p role="alert">{error}</p>}
    {result && <section><h2>Results</h2>
      {result.providerStatus.map((status) => <p key={status.provider}>{status.provider}: {status.state}</p>)}
      {result.candidates.map((candidate) => <article key={candidate.solutionKey}>
        <h3>{candidate.name}</h3><p>{candidate.matchReason}</p><p>{candidate.score.trustLevel}</p>
        <label><input type="checkbox" checked={selectedKeys.includes(candidate.solutionKey)} onChange={() => toggleSelection(candidate.solutionKey)} />Select {candidate.name}</label>
        <h4>Evidence</h4><ul>{candidate.evidence.map((evidence) => <li key={evidence.sourceUrl}><a href={evidence.sourceUrl}>{evidence.sourceUrl}</a>{evidence.excerpt ? ` — ${evidence.excerpt}` : ''}</li>)}</ul>
        {candidate.score.warnings.map((warning) => <p key={warning.message} role="alert">{warning.category}: {warning.message}</p>)}
      </article>)}
      <button type="button" onClick={() => download('report')} disabled={selectedKeys.length === 0}>Download report</button>
      <button type="button" onClick={() => download('skill')} disabled={selectedKeys.length === 0}>Download skill</button>
      <p>Exports retain selected evidence and safety warnings.</p>
    </section>}
  </main>;
}

async function discoverFromGateway(request: DiscoveryRequest): Promise<DiscoveryResult> {
  const response = await fetch('/api/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Discovery failed.');
  return response.json() as Promise<DiscoveryResult>;
}
