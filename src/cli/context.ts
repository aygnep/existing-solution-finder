import { redactSensitiveText } from '../feedback/redaction.js';
export { redactSensitiveText, sanitizeForOutput } from '../feedback/redaction.js';
import { readFile } from 'node:fs/promises';

export interface ContextFileInput {
  readonly problem?: string;
  readonly stack: readonly string[];
  readonly constraints: readonly string[];
  readonly attemptedFixes: readonly string[];
  readonly environment: Readonly<Record<string, unknown>>;
}

export interface EffectiveCliContext {
  readonly problem: string;
  readonly stack: readonly string[];
  readonly constraints: readonly string[];
  readonly attemptedFixes: readonly string[];
  readonly environment: Readonly<Record<string, unknown>>;
}

export interface MergeCliContextOptions {
  readonly cliProblem: string;
  readonly cliStack?: string;
  readonly cliConstraints?: string;
  readonly fileContext?: ContextFileInput;
}

const EMPTY_CONTEXT: ContextFileInput = {
  stack: [],
  constraints: [],
  attemptedFixes: [],
  environment: {},
};

const SAFE_ENVIRONMENT_KEY =
  /^(?:os|osVersion|platform|arch|architecture|runtime|runtimeVersion|node|nodeVersion|deno|bun|python|go|rust|java|npm|pnpm|yarn|packageManager|packageManagerVersion|shell|container|containerRuntime|ci|language|languageVersion|framework|frameworkVersion|versions|dependencies|dependencyVersions)$/i;
const SENSITIVE_KEY = /(?:api.?key|token|secret|password|passwd|credential|authorization|cookie|session|private.?key)/i;

export async function loadContextFile(filePath: string): Promise<ContextFileInput> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read context file: ${safeErrorMessage(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Context file is not valid JSON: ${safeErrorMessage(error)}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Context file must contain a JSON object.');
  }

  return {
    problem: optionalString(parsed, 'problem'),
    stack: optionalStringArray(parsed, 'stack'),
    constraints: optionalStringArray(parsed, 'constraints'),
    attemptedFixes: optionalStringArray(parsed, 'attemptedFixes'),
    environment: optionalObject(parsed, 'environment'),
  };
}

export function mergeCliContext(options: MergeCliContextOptions): EffectiveCliContext {
  const fileContext = options.fileContext ?? EMPTY_CONTEXT;
  const cliProblem = redactSensitiveText(options.cliProblem.trim());
  const fileProblem = redactSensitiveText(fileContext.problem?.trim() ?? '');
  const baseProblem = cliProblem || fileProblem;
  const attemptedFixes = unique(
    fileContext.attemptedFixes
      .map((item) => redactSensitiveText(item.trim()))
      .filter(Boolean),
  );
  const environment = sanitizeEnvironment(fileContext.environment);

  return {
    problem: appendAgentContext(baseProblem, attemptedFixes, environment),
    stack: unique([
      ...fileContext.stack.map((item) => redactSensitiveText(item.trim())),
      ...parseCommaSeparated(options.cliStack).map(redactSensitiveText),
    ]),
    constraints: unique([
      ...fileContext.constraints.map((item) => redactSensitiveText(item.trim())),
      ...parseCommaSeparated(options.cliConstraints).map(redactSensitiveText),
    ]),
    attemptedFixes,
    environment,
  };
}

function appendAgentContext(
  problem: string,
  attemptedFixes: readonly string[],
  environment: Readonly<Record<string, unknown>>,
): string {
  if (!problem) return '';
  const sections = [problem];

  if (attemptedFixes.length > 0) {
    sections.push(`Attempted fixes:\n${attemptedFixes.map((item) => `- ${item}`).join('\n')}`);
  }

  if (Object.keys(environment).length > 0) {
    sections.push(`Environment: ${JSON.stringify(environment)}`);
  }

  return sections.filter(Boolean).join('\n\n');
}

function sanitizeEnvironment(
  environment: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(environment).sort()) {
    if (!SAFE_ENVIRONMENT_KEY.test(key) || SENSITIVE_KEY.test(key)) continue;
    const value = sanitizeEnvironmentValue(environment[key], 0);
    if (value !== undefined) sanitized[key] = value;
  }

  return sanitized;
}

function sanitizeEnvironmentValue(value: unknown, depth: number): unknown {
  if (depth > 2 || value === undefined) return undefined;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactSensitiveText(value.slice(0, 200));

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizeEnvironmentValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (!isPlainObject(value)) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort().slice(0, 50)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const item = sanitizeEnvironmentValue(value[key], depth + 1);
    if (item !== undefined) sanitized[key] = item;
  }
  return sanitized;
}

function parseCommaSeparated(value: string | undefined): readonly string[] {
  if (!value?.trim()) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))];
}

function optionalString(
  input: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`Context field "${key}" must be a string.`);
  return value;
}

function optionalStringArray(
  input: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] {
  const value = input[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Context field "${key}" must be an array of strings.`);
  }
  return value as readonly string[];
}

function optionalObject(
  input: Readonly<Record<string, unknown>>,
  key: string,
): Readonly<Record<string, unknown>> {
  const value = input[key];
  if (value === undefined) return {};
  if (!isPlainObject(value)) throw new Error(`Context field "${key}" must be an object.`);
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeErrorMessage(error: unknown): string {
  return redactSensitiveText(error instanceof Error ? error.message : String(error));
}
