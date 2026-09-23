import { z } from 'zod';
import type { JevReranker, JevRerankResult } from '../core/discovery-service.js';
import { redactSensitiveText } from '../feedback/redaction.js';
import type { SolutionCandidate } from '../types/discovery.js';
import type { Env } from '../utils/env.js';
import { mapWithConcurrency } from './provider-runtime.js';

const API_URL = 'https://api.typesafe.ai/v1/systemone';
const MAX_CONCURRENCY = 6;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_EXCERPT_LENGTH = 900;

const responseSchema = z.object({
  model: z.string().min(1),
  answers: z.object({
    relevant: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }),
    compatible: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }),
    evidence: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }),
  }),
});

export interface JevRerankerDependencies {
  readonly fetchImpl?: typeof fetch;
}

export function createJevReranker(
  env: Env,
  dependencies: JevRerankerDependencies = {},
): JevReranker | undefined {
  if (!env.TYPESAFE_API_KEY) return undefined;
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  return {
    async evaluate(input): Promise<JevRerankResult> {
      const judgments = await mapWithConcurrency(input.candidates, MAX_CONCURRENCY, async (candidate) => {
        const response = await callJev({
          problem: input.problem,
          stack: input.stack,
          constraints: input.constraints,
          candidate,
          apiKey: env.TYPESAFE_API_KEY!,
          model: env.JEV_MODEL ?? 'jev-1.13.0',
          timeoutMs: env.REQUEST_TIMEOUT_MS,
          fetchImpl,
        });
        return {
          solutionKey: candidate.solutionKey,
          relevanceProbability: response.answers.relevant.noul,
          compatibilityProbability: response.answers.compatible.noul,
          evidenceProbability: response.answers.evidence.noul,
          model: response.model,
        };
      });

      return { model: judgments[0]?.model ?? env.JEV_MODEL ?? 'jev-1.13.0', judgments };
    },
  };
}

interface CallInput {
  readonly problem: string;
  readonly stack: readonly string[];
  readonly constraints: readonly string[];
  readonly candidate: SolutionCandidate;
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly fetchImpl: typeof fetch;
}

async function callJev(input: CallInput): Promise<z.infer<typeof responseSchema>> {
  const state = {
    problem: redactSensitiveText(input.problem).slice(0, 2_000),
    stack: input.stack.map((item) => redactSensitiveText(item).slice(0, 100)),
    constraints: input.constraints.map((item) => redactSensitiveText(item).slice(0, 200)),
    candidate: {
      name: redactSensitiveText(input.candidate.name).slice(0, 200),
      description: redactSensitiveText(input.candidate.description).slice(0, 500),
      evidence: input.candidate.evidence.slice(0, MAX_EVIDENCE_ITEMS).map((item) => ({
        kind: item.sourceKind,
        title: redactSensitiveText(item.title).slice(0, 200),
        excerpt: redactSensitiveText(item.excerpt ?? '').slice(0, MAX_EXCERPT_LENGTH),
      })),
    },
  };
  const body = {
    model: input.model,
    state,
    questions: {
      relevant: {
        type: 'noul',
        instructions: 'Does `candidate` directly address the symptom or goal in `problem`, rather than merely mention the same technology?',
        criteria: {
          true: 'The candidate describes a fix, issue, package, or workaround for the specific symptom or goal.',
          false: 'The candidate is only topically related or addresses a different symptom or goal.',
        },
      },
      compatible: {
        type: 'noul',
        instructions: 'Based on `candidate` and its evidence, does it fit the stated `stack` and `constraints` for `problem`?',
        criteria: {
          true: 'No stated requirement conflicts with the candidate, and the evidence supports the relevant stack or constraint where specified.',
          false: 'The candidate explicitly conflicts with a stated stack, version, license, deployment, or other constraint.',
        },
      },
      evidence: {
        type: 'noul',
        instructions: 'Does `candidate.evidence` state a concrete, checkable fix or documented behavior for `problem`?',
        criteria: {
          true: 'The excerpt gives a specific fix, affected behavior, or supported package capability that can be checked at its source.',
          false: 'The excerpt is only a title, generic description, promotion, or unrelated text; the claimed fix is not evidenced here.',
        },
      },
    },
  };

  let response: Response;
  try {
    response = await input.fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch (error) {
    throw new Error(isTimeout(error) ? 'Jev request timed out.' : 'Jev network request failed.');
  }

  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? 'Jev authentication failed.'
      : response.status === 429 ? 'Jev rate limit reached.' : 'Jev API request failed.');
  }

  try {
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('invalid response');
    return parsed.data;
  } catch {
    throw new Error('Jev returned an invalid response.');
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
