import type { ValidationStep } from '../types/discovery.js';
import type { RankedCandidate } from '../types/score.js';

export function createValidationSteps(candidate: RankedCandidate): readonly ValidationStep[] {
  const riskReview: readonly ValidationStep[] =
    candidate.score.trustLevel === 'BLOCKED'
      ? [{
      id: 'review-risk',
      instruction: 'Review the cited source and every displayed warning; do not execute any candidate command.',
      expectedObservation: 'The archive, script, secret-transmission, or other blocking risk is explicitly identified.',
      riskNote: 'This candidate is blocked by Fixseek safety rules; do not run its installation command.',
    }]
      : [];

  return [
    ...riskReview,
    {
      id: 'verify-independent-sources',
      instruction: 'Verify the claim against at least two independent sources when two are available; otherwise record that only one source was found.',
      expectedObservation: 'Independent sources agree on the error, cause, workaround, or package behavior, or the evidence gap is documented.',
    },
    {
      id: 'check-versions-constraints',
      instruction: 'Compare affected and fixed versions, operating system, runtime, package manager, license, and stated constraints with the current project.',
      expectedObservation: 'The candidate applicability boundary is explicit and matches the project, or each mismatch is recorded.',
    },
    {
      id: 'propose-isolated-test',
      instruction: 'Propose the smallest isolated test that could confirm or falsify the candidate without production data or secrets.',
      expectedObservation: 'The test has a concrete input, expected result, and failure signal, without executing candidate-provided commands.',
    },
    {
      id: 'propose-rollback',
      instruction: 'Define a rollback before any implementation, including which files, dependencies, configuration, or state would be restored.',
      expectedObservation: 'A bounded, recoverable rollback path exists before the candidate is tried.',
    },
    {
      id: 'record-observed-result',
      instruction: 'After an authorized test, record the actual observation as useful, not-useful, or unsafe with the candidate URL and problem fingerprint.',
      expectedObservation: 'The observed result and any new error differ clearly from the expected result and are available for later ranking feedback.',
    },
    {
      id: 'refine-or-research',
      instruction: 'If validation fails or evidence conflicts, refine the problem with the observed result and research again before proposing another change.',
      expectedObservation: 'The next search includes the new error, version boundary, failed assumption, or safety finding.',
    },
  ];
}
