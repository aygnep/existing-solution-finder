import { createValidationSteps } from '../src/core/validation-guidance';
import type { RankedCandidate } from '../src/types/score';

const blockedCandidate = {
  id: 'https://github.com/example/risky',
  name: 'risky',
  url: 'https://github.com/example/risky',
  description: 'Risky tool',
  provider: 'github',
  metadata: { hasSuspiciousInstallScript: true },
  score: {
    breakdown: { exactErrorMatch: 0, stackMatch: 0, readmeEvidence: 0, recency: 0, installationClarity: 0, maintenanceActivity: 0, exampleConfig: 0 },
    penalties: [], subtotal: 0, total: 0, displayTotal: 0,
    trustLevel: 'BLOCKED' as const,
    warnings: [{ category: 'PENALTY', message: 'Suspicious install script' }],
  },
  rank: 1,
  candidateType: 'tool' as const,
  matchReason: 'Risky.',
  nextStep: 'Do not run it.',
} satisfies RankedCandidate;

describe('createValidationSteps', () => {
  it('does not tell users to install a blocked candidate', () => {
    const steps = createValidationSteps(blockedCandidate);

    expect(steps.map((step) => step.instruction).join(' ')).not.toMatch(/npm install|go install|pip install/);
    expect(steps[0]!.riskNote).toContain('blocked');
  });
});
