import type { Language } from '../i18n/types.js';
import type { Provider } from '../types/candidate.js';
import type { DiscoveryMode, DiscoveryResult, ProviderStatus } from '../types/discovery.js';
import type { OutcomeRecord } from '../types/feedback.js';
import { redactSensitiveText } from '../feedback/redaction.js';
import { sanitizeForOutput } from './context.js';

export const AGENT_SCHEMA_VERSION = '1.3' as const;

export interface AgentInvocationMetadata {
  readonly command: 'solve';
  readonly mode: DiscoveryMode;
  readonly explicitMode: 'default' | 'mock' | 'real';
  readonly language: Language;
  readonly providers: readonly Provider[];
  readonly maxResults: number;
  readonly reranker: 'none' | 'jev' | 'laya';
  readonly input: {
    readonly source: 'arguments' | 'stdin' | 'context-file';
    readonly contextFileLoaded: boolean;
    readonly attemptedFixesCount: number;
    readonly environmentKeys: readonly string[];
  };
  readonly mergePolicy: {
    readonly problem: 'cli-or-stdin-over-context-file';
    readonly stack: 'context-file-then-cli-deduplicated';
    readonly constraints: 'context-file-then-cli-deduplicated';
  };
}

export interface AgentProviderWarning {
  readonly code: 'provider_skipped' | 'provider_failed' | 'provider_partial';
  readonly provider: Provider;
  readonly state: 'skipped' | 'failed' | 'partial';
  readonly message?: string;
}

export interface AgentDiscoveryEnvelope {
  readonly schemaVersion: typeof AGENT_SCHEMA_VERSION;
  readonly kind: 'fixseek.discovery';
  readonly ok: true;
  readonly invocation: AgentInvocationMetadata;
  readonly warnings: readonly AgentProviderWarning[];
  readonly result: DiscoveryResult;
}

export interface AgentErrorEnvelope {
  readonly schemaVersion: typeof AGENT_SCHEMA_VERSION;
  readonly kind: 'fixseek.error';
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export interface FeedbackInvocationMetadata {
  readonly command: 'feedback';
  readonly problemInput: 'problem' | 'problem-fingerprint';
  readonly outcomeFile: string;
}

export interface AgentFeedbackEnvelope {
  readonly schemaVersion: typeof AGENT_SCHEMA_VERSION;
  readonly kind: 'fixseek.feedback';
  readonly ok: true;
  readonly invocation: FeedbackInvocationMetadata;
  readonly result: {
    readonly record: OutcomeRecord;
  };
}

export function createDiscoveryEnvelope(
  invocation: AgentInvocationMetadata,
  result: DiscoveryResult,
): AgentDiscoveryEnvelope {
  return sanitizeForOutput({
    schemaVersion: AGENT_SCHEMA_VERSION,
    kind: 'fixseek.discovery',
    ok: true,
    invocation,
    warnings: providerWarnings(result.providerStatus),
    result,
  });
}

export function createErrorEnvelope(code: string, message: string): AgentErrorEnvelope {
  return sanitizeForOutput({
    schemaVersion: AGENT_SCHEMA_VERSION,
    kind: 'fixseek.error',
    ok: false,
    error: { code, message },
  });
}

export function createFeedbackEnvelope(
  invocation: FeedbackInvocationMetadata,
  record: OutcomeRecord,
): AgentFeedbackEnvelope {
  return {
    schemaVersion: AGENT_SCHEMA_VERSION,
    kind: 'fixseek.feedback',
    ok: true,
    invocation: {
      ...invocation,
      outcomeFile: redactSensitiveText(invocation.outcomeFile),
    },
    result: {
      record: {
        ...record,
        candidateUrl: redactSensitiveText(record.candidateUrl),
        problemFingerprint: redactSensitiveText(record.problemFingerprint),
        ...(record.notes === undefined
          ? {}
          : { notes: redactSensitiveText(record.notes) }),
      },
    },
  };
}

function providerWarnings(statuses: readonly ProviderStatus[]): readonly AgentProviderWarning[] {
  return statuses.flatMap((status) => {
    if (status.state !== 'skipped' && status.state !== 'failed' && status.state !== 'partial') return [];
    return [{
      code: status.state === 'skipped' ? 'provider_skipped' : status.state === 'partial' ? 'provider_partial' : 'provider_failed',
      provider: status.provider,
      state: status.state,
      ...(status.message ? { message: status.message } : {}),
    }];
  });
}
