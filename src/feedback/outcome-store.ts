import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  OUTCOME_SCHEMA_VERSION,
  type AppendOutcomeOptions,
  type CandidateOutcome,
  type OutcomeInput,
  type OutcomeRecord,
} from '../types/feedback.js';
import { redactSensitiveText } from './redaction.js';

const VALID_OUTCOMES = new Set<CandidateOutcome>([
  'useful',
  'not-useful',
  'unsafe',
]);

export function fingerprintProblem(problem: string): string {
  const normalized = problem.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) {
    throw new Error('Problem text must not be empty.');
  }
  return createHash('sha256').update(normalized).digest('hex');
}

export async function appendOutcome(
  filePath: string,
  input: OutcomeInput,
  options: AppendOutcomeOptions = {},
): Promise<OutcomeRecord> {
  const record: OutcomeRecord = {
    schemaVersion: OUTCOME_SCHEMA_VERSION,
    candidateUrl: input.candidateUrl,
    problemFingerprint: input.problemFingerprint,
    outcome: input.outcome,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    timestamp: (options.now ?? new Date()).toISOString(),
  };
  const serialized = serializeOutcomeRecord(record);
  const safeRecord = parseOutcomeRecord(serialized);

  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  const handle = await open(filePath, 'a', 0o600);
  try {
    await handle.chmod(0o600);
    await handle.appendFile(`${serialized}\n`, 'utf8');
  } finally {
    await handle.close();
  }
  return safeRecord;
}

export async function loadOutcomes(
  filePath: string,
): Promise<readonly OutcomeRecord[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) return [];
    throw error;
  }

  const records: OutcomeRecord[] = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      records.push(parseOutcomeRecord(line));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Malformed outcome record at line ${index + 1}: ${message}`);
    }
  }
  return records;
}

export function serializeOutcomeRecord(record: OutcomeRecord): string {
  const valid = validateOutcomeRecord(record);
  return JSON.stringify(redactOutcomeRecord(valid));
}

export function parseOutcomeRecord(line: string): OutcomeRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error('Record is not valid JSON.');
  }
  return redactOutcomeRecord(validateOutcomeRecord(parsed));
}

function validateOutcomeRecord(value: unknown): OutcomeRecord {
  if (!isRecord(value)) {
    throw new Error('Record must be a JSON object.');
  }
  if (value.schemaVersion !== OUTCOME_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion: ${String(value.schemaVersion)}.`);
  }
  if (!isHttpUrl(value.candidateUrl)) {
    throw new Error('candidateUrl must be an absolute HTTP(S) URL.');
  }
  if (
    typeof value.problemFingerprint !== 'string' ||
    value.problemFingerprint.trim().length === 0
  ) {
    throw new Error('problemFingerprint must be a non-empty string.');
  }
  if (
    typeof value.outcome !== 'string' ||
    !VALID_OUTCOMES.has(value.outcome as CandidateOutcome)
  ) {
    throw new Error('outcome must be useful, not-useful, or unsafe.');
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') {
    throw new Error('notes must be a string when provided.');
  }
  if (
    typeof value.timestamp !== 'string' ||
    !isIsoTimestamp(value.timestamp)
  ) {
    throw new Error('timestamp must be a valid ISO-8601 timestamp.');
  }

  return {
    schemaVersion: OUTCOME_SCHEMA_VERSION,
    candidateUrl: value.candidateUrl,
    problemFingerprint: value.problemFingerprint,
    outcome: value.outcome as CandidateOutcome,
    ...(value.notes === undefined ? {} : { notes: value.notes }),
    timestamp: value.timestamp,
  };
}

function redactOutcomeRecord(record: OutcomeRecord): OutcomeRecord {
  return {
    ...record,
    candidateUrl: redactSensitiveText(record.candidateUrl),
    problemFingerprint: redactSensitiveText(record.problemFingerprint),
    ...(record.notes === undefined
      ? {}
      : { notes: redactSensitiveText(record.notes) }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isIsoTimestamp(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
