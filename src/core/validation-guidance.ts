import type { ValidationStep } from '../types/discovery.js';
import type { RankedCandidate } from '../types/score.js';

export function createValidationSteps(candidate: RankedCandidate): readonly ValidationStep[] {
  if (candidate.score.trustLevel === 'BLOCKED') {
    return [{
      id: 'review-risk',
      instruction: 'Read the linked source and displayed warnings before considering this candidate.',
      expectedObservation: 'You can identify the archived, script, or secret-transmission risk.',
      riskNote: 'This candidate is blocked by Fixseek safety rules; do not run its installation command.',
    }];
  }

  return [
    {
      id: 'review-evidence',
      instruction: 'Open the cited source and confirm the evidence applies to your stack.',
      expectedObservation: 'The source names the relevant tool, error, or compatibility condition.',
    },
    {
      id: 'check-compatibility',
      instruction: 'Check the license, supported versions, and configuration example.',
      expectedObservation: 'Your constraints are supported or the gap is understood.',
    },
    {
      id: 'try-isolated',
      instruction: 'If you choose to proceed, test the documented setup in an isolated environment first.',
      expectedObservation: 'Expected behavior occurs without production secrets.',
    },
  ];
}
