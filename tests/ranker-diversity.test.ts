import { rankCandidates } from '../src/core/ranker';
import type { Provider } from '../src/types/candidate';
import type { ScoredCandidate, TrustLevel } from '../src/types/score';

function candidate(
  name: string,
  provider: Provider,
  displayTotal: number,
  trustLevel: TrustLevel = 'HIGH',
): ScoredCandidate {
  return {
    id: `https://example.com/${provider}/${name}`,
    name,
    url: `https://example.com/${provider}/${name}`,
    description: `${name} evidence`,
    provider,
    metadata: {},
    score: {
      breakdown: {
        exactErrorMatch: 0,
        stackMatch: 0,
        readmeEvidence: 0,
        recency: 0,
        installationClarity: 0,
        maintenanceActivity: 0,
        exampleConfig: 0,
      },
      penalties: [],
      subtotal: displayTotal,
      total: displayTotal,
      displayTotal,
      trustLevel,
      warnings: [],
    },
  };
}

describe('rankCandidates provider diversity', () => {
  it('reserves result slots for viable providers without changing score order', () => {
    const ranked = rankCandidates([
      candidate('github-one', 'github', 100),
      candidate('github-two', 'github', 99),
      candidate('github-three', 'github', 98),
      candidate('npm-one', 'npm', 90),
      candidate('web-one', 'web', 80),
    ], { maxResults: 3 });

    expect(ranked.map((item) => item.provider)).toEqual(['github', 'npm', 'web']);
    expect(ranked.map((item) => item.score.displayTotal)).toEqual([100, 90, 80]);
    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 3]);
  });

  it('chooses the strongest provider leaders when slots are fewer than providers', () => {
    const ranked = rankCandidates([
      candidate('github-one', 'github', 100),
      candidate('github-two', 'github', 99),
      candidate('web-one', 'web', 85),
      candidate('npm-one', 'npm', 70),
    ], { maxResults: 2 });

    expect(ranked.map((item) => item.name)).toEqual(['github-one', 'web-one']);
  });

  it('does not promote blocked or poor matches solely for diversity', () => {
    const ranked = rankCandidates([
      candidate('github-one', 'github', 100),
      candidate('github-two', 'github', 90),
      candidate('blocked-web', 'web', 80, 'BLOCKED'),
      candidate('poor-npm', 'npm', 9),
    ], { maxResults: 2 });

    expect(ranked.map((item) => item.name)).toEqual(['github-one', 'github-two']);
  });
});
