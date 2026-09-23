import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import type { DiscoveryResult } from '../../src/types/discovery';

const result = {
  request: { problem: 'Vite cannot find module', stack: [], constraints: [], providers: ['github'], mode: 'real', maxResults: 10 },
  parsedProblem: { raw: '', errorTokens: [], stackNames: [], versions: [], constraints: [], keywords: [] },
  searchPlan: [{ query: 'Vite module', category: 'exact-error', providers: ['github'] }],
  providerStatus: [{ provider: 'github', state: 'complete', resultCount: 1 }, { provider: 'web', state: 'skipped', resultCount: 0, message: 'Missing key' }],
  candidates: [{
    id: 'https://example.com/tool', solutionKey: 'https://example.com/tool', name: 'example/tool', url: 'https://example.com/tool',
    description: 'Example tool', provider: 'github', metadata: {}, rank: 1, candidateType: 'tool', matchReason: 'Direct match.', nextStep: 'Read source.',
    score: { breakdown: { exactErrorMatch: 25, stackMatch: 20, readmeEvidence: 15, recency: 10, installationClarity: 10, maintenanceActivity: 10, exampleConfig: 10 }, penalties: [], subtotal: 100, total: 100, displayTotal: 100, trustLevel: 'HIGH', warnings: [] },
    evidence: [{ sourceUrl: 'https://example.com/tool', sourceKind: 'github', title: 'example/tool', excerpt: 'Evidence', retrievedAt: '2026-07-13T00:00:00.000Z' }],
    relatedCandidates: [],
    validationSteps: [{ id: 'review-evidence', instruction: 'Review evidence.', expectedObservation: 'Evidence applies.' }],
  }],
  completedAt: '2026-07-13T00:00:00.000Z',
} satisfies DiscoveryResult;

describe('Solution Guide', () => {
  it('shows progress and prevents duplicate submissions while providers are running', async () => {
    let resolveDiscovery!: (value: DiscoveryResult) => void;
    const discover = jest.fn(() => new Promise<DiscoveryResult>((resolve) => {
      resolveDiscovery = resolve;
    }));
    render(<App discover={discover} />);

    fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Vite cannot find module' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search solutions' }));

    expect(screen.getByRole('status')).toHaveTextContent('Searching providers');
    expect(screen.getByRole('button', { name: 'Searching providers…' })).toBeDisabled();
    expect(screen.getByLabelText('Describe the problem')).toBeDisabled();
    expect(screen.getByLabelText('Tech stack')).toBeDisabled();
    expect(screen.getByLabelText('Constraints')).toBeDisabled();
    expect(screen.getByLabelText('GitHub')).toBeDisabled();
    expect(screen.getByLabelText('npm')).toBeDisabled();
    expect(screen.getByLabelText('Web')).toBeDisabled();
    resolveDiscovery(result);
    await screen.findByLabelText('Provider status');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Describe the problem')).toBeEnabled();
    expect(screen.getByLabelText('GitHub')).toBeEnabled();
  });

  it('sends a real-mode request from the workbench', async () => {
    const discover = jest.fn().mockResolvedValue(result);
    render(<App discover={discover} />);

    fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Vite cannot find module' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search solutions' }));

    await waitFor(() => expect(discover).toHaveBeenCalledWith(expect.objectContaining({ mode: 'real' })));
  });

  it('only requests Jev when the user opts in', async () => {
    const discover = jest.fn().mockResolvedValue(result);
    render(<App discover={discover} />);

    fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Vite cannot find module' } });
    fireEvent.change(screen.getByLabelText('Handoff ranking'), { target: { value: 'jev' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search solutions' }));

    await waitFor(() => expect(discover).toHaveBeenCalledWith(expect.objectContaining({ reranker: 'jev' })));
  });

  it('selects the local Laya backend separately from hosted Jev', async () => {
    const discover = jest.fn().mockResolvedValue(result);
    render(<App discover={discover} />);

    fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Vite cannot find module' } });
    fireEvent.change(screen.getByLabelText('Handoff ranking'), { target: { value: 'laya' } });
    expect(screen.getByText(/remain on this computer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search solutions' }));

    await waitFor(() => expect(discover).toHaveBeenCalledWith(expect.objectContaining({ reranker: 'laya' })));
  });

  it('switches system-generated result text to Chinese without another discovery request', async () => {
    const discover = jest.fn().mockResolvedValue(result);
    render(<App discover={discover} />);

    fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Vite cannot find module' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search solutions' }));
    await screen.findByRole('heading', { name: 'example/tool' });
    fireEvent.click(screen.getByRole('button', { name: '中文' }));

    expect(screen.getByText('匹配原因')).toBeInTheDocument();
    expect(screen.getByText(/Web：已跳过/)).toBeInTheDocument();
    expect(discover).toHaveBeenCalledTimes(1);
  });
});
