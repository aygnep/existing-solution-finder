export {
  appendOutcome,
  fingerprintProblem,
  loadOutcomes,
  parseOutcomeRecord,
  serializeOutcomeRecord,
} from './outcome-store.js';
export { redactSensitiveText } from './redaction.js';
export {
  OUTCOME_SCHEMA_VERSION,
  type AppendOutcomeOptions,
  type CandidateOutcome,
  type OutcomeInput,
  type OutcomeRecord,
} from '../types/feedback.js';
