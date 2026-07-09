import { renderAgentSkill, renderSolutionReport } from '../src/exports/solution-report';
import type { DiscoveryRequest, SolutionCandidate } from '../src/types/discovery';

const request: DiscoveryRequest = {
  problem: 'Vite cannot find a module',
  stack: ['Vite'],
  constraints: ['open source'],
  providers: ['github'],
  mode: 'mock',
  maxResults: 5,
};

const solution = {
  id: 'https://github.com/example/tool', name: 'example/tool', url: 'https://github.com/example/tool',
  description: 'Example tool', provider: 'github', metadata: {}, rank: 1,
  candidateType: 'tool', matchReason: 'Direct match.', nextStep: 'Read source.',
  score: {
    breakdown: { exactErrorMatch: 0, stackMatch: 0, readmeEvidence: 0, recency: 0, installationClarity: 0, maintenanceActivity: 0, exampleConfig: 0 },
    penalties: [], subtotal: 0, total: 0, displayTotal: 0, trustLevel: 'BLOCKED' as const,
    warnings: [{ category: 'PENALTY', message: 'Suspicious install script' }],
  },
  solutionKey: 'https://github.com/example/tool', relatedCandidates: [],
  evidence: [{ sourceUrl: 'https://github.com/example/tool', sourceKind: 'github' as const, title: 'example/tool', excerpt: 'Evidence', retrievedAt: '2026-07-10T00:00:00.000Z' }],
  validationSteps: [{ id: 'review-risk', instruction: 'Review risk.', expectedObservation: 'Risk identified.', riskNote: 'Blocked.' }],
} satisfies SolutionCandidate;

describe('solution exporters', () => {
  it('keeps evidence and warnings in the Markdown report', () => {
    const markdown = renderSolutionReport({ request, candidates: [solution] });

    expect(markdown).toContain(solution.evidence[0]!.sourceUrl);
    expect(markdown).toContain('BLOCKED');
  });

  it('renders a skill as guidance instead of executable automation', () => {
    const skill = renderAgentSkill({ request, candidates: [solution] });

    expect(skill).toContain('Never install or execute a candidate automatically.');
    expect(skill).toContain(solution.evidence[0]!.sourceUrl);
  });
});
