import { z } from 'zod';
import type { DecisionReranker, DecisionRerankResult } from '../core/discovery-service.js';
import { redactSensitiveText } from '../feedback/redaction.js';
import type { RerankerProvider, SolutionCandidate } from '../types/discovery.js';
import type { Env } from '../utils/env.js';
import { mapWithConcurrency } from './provider-runtime.js';

const JEV_API_URL = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_LAYA_PORT = 8766;

const responseSchema = z.object({
  model: z.string().min(1),
  routing: z.object({ model: z.string().min(1).optional() }).optional(),
  answers: z.object({
    relevant: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }),
    compatible: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }),
    evidence: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }),
  }),
});

export interface RerankerDependencies {
  readonly fetchImpl?: typeof fetch;
}

interface RerankerConfig {
  readonly provider: RerankerProvider;
  readonly url: string;
  readonly healthUrl?: string;
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs: number;
  readonly concurrency: number;
  readonly maxProblemChars: number;
  readonly maxDescriptionChars: number;
  readonly maxEvidenceItems: number;
  readonly maxExcerptChars: number;
}

export function createJevReranker(env: Env, dependencies: RerankerDependencies = {}): DecisionReranker | undefined {
  if (!env.TYPESAFE_API_KEY) return undefined;
  return createSystemOneReranker({
    provider: 'jev', url: JEV_API_URL, apiKey: env.TYPESAFE_API_KEY,
    model: env.JEV_MODEL ?? 'jev-1.13.0', timeoutMs: env.REQUEST_TIMEOUT_MS,
    concurrency: 6, maxProblemChars: 2_000, maxDescriptionChars: 500,
    maxEvidenceItems: 3, maxExcerptChars: 900,
  }, dependencies.fetchImpl ?? fetch);
}

export function createLayaReranker(env: Env, dependencies: RerankerDependencies = {}): DecisionReranker {
  const base = `http://127.0.0.1:${env.LAYA_PORT ?? DEFAULT_LAYA_PORT}`;
  return createSystemOneReranker({
    provider: 'laya', url: `${base}/v1/systemone`, healthUrl: `${base}/health`,
    timeoutMs: env.REQUEST_TIMEOUT_MS, concurrency: 2,
    maxProblemChars: 500, maxDescriptionChars: 240,
    maxEvidenceItems: 2, maxExcerptChars: 250,
  }, dependencies.fetchImpl ?? fetch);
}

function createSystemOneReranker(config: RerankerConfig, fetchImpl: typeof fetch): DecisionReranker {
  return {
    async evaluate(input): Promise<DecisionRerankResult> {
      if (config.healthUrl) await checkLayaHealth(config.healthUrl, fetchImpl);
      const judgments = await mapWithConcurrency(input.candidates, config.concurrency, async (candidate) => {
        const response = await callSystemOne({
          problem: input.problem, stack: input.stack, constraints: input.constraints,
          candidate, config, fetchImpl,
        });
        const model = config.provider === 'laya' && response.routing?.model
          ? `laya/${response.routing.model}` : response.model;
        return {
          solutionKey: candidate.solutionKey,
          relevanceProbability: response.answers.relevant.noul,
          compatibilityProbability: response.answers.compatible.noul,
          evidenceProbability: response.answers.evidence.noul,
          model,
        };
      });
      return { model: judgments[0]?.model ?? config.model ?? 'laya-auto', judgments };
    },
  };
}

async function checkLayaHealth(url: string, fetchImpl: typeof fetch): Promise<void> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(1_500) });
    if (response.ok) return;
  } catch {
    // A missing or stopped local server is reported through the normal fallback.
  }
  throw new Error('Laya local server is unavailable.');
}

interface CallInput {
  readonly problem: string;
  readonly stack: readonly string[];
  readonly constraints: readonly string[];
  readonly candidate: SolutionCandidate;
  readonly config: RerankerConfig;
  readonly fetchImpl: typeof fetch;
}

async function callSystemOne(input: CallInput): Promise<z.infer<typeof responseSchema>> {
  const { config } = input;
  const providerName = config.provider === 'jev' ? 'Jev' : 'Laya';
  const state = {
    problem: redactSensitiveText(input.problem).slice(0, config.maxProblemChars),
    stack: input.stack.map((item) => redactSensitiveText(item).slice(0, 100)),
    constraints: input.constraints.map((item) => redactSensitiveText(item).slice(0, 200)),
    candidate: {
      name: redactSensitiveText(input.candidate.name).slice(0, 200),
      description: redactSensitiveText(input.candidate.description).slice(0, config.maxDescriptionChars),
      evidence: input.candidate.evidence.slice(0, config.maxEvidenceItems).map((item) => ({
        kind: item.sourceKind,
        title: redactSensitiveText(item.title).slice(0, 200),
        excerpt: redactSensitiveText(item.excerpt ?? '').slice(0, config.maxExcerptChars),
      })),
    },
  };
  const body = {
    ...(config.model ? { model: config.model } : {}),
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
    response = await input.fetchImpl(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw new Error(isTimeout(error) ? `${providerName} request timed out.` : `${providerName} network request failed.`);
  }
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? `${providerName} authentication failed.`
      : response.status === 429 ? `${providerName} rate limit reached.` : `${providerName} API request failed.`);
  }
  try {
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('invalid response');
    return parsed.data;
  } catch {
    throw new Error(`${providerName} returned an invalid response.`);
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
