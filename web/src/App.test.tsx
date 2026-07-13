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
  it('sends a real-mode request from the workbench', async () => {
    const discover = jest.fn().mockResolvedValue(result);
    render(<App discover={discover} />);

    fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Vite cannot find module' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search solutions' }));

    await waitFor(() => expect(discover).toHaveBeenCalledWith(expect.objectContaining({ mode: 'real' })));
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
