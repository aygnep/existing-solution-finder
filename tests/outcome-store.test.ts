import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendOutcome,
  fingerprintProblem,
  loadOutcomes,
  parseOutcomeRecord,
  serializeOutcomeRecord,
} from '../src/feedback';
import type { OutcomeRecord } from '../src/types/feedback';

describe('outcome feedback store', () => {
  it('appends and loads versioned JSONL records', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fixseek-outcomes-'));
    const filePath = join(directory, 'feedback', 'outcomes.jsonl');
    const now = new Date('2026-07-23T04:05:06.000Z');

    const appended = await appendOutcome(filePath, {
      candidateUrl: 'https://github.com/example/tool/issues/42',
      problemFingerprint: fingerprintProblem(' Node failure   on version 22 '),
      outcome: 'useful',
      notes: 'Confirmed in an isolated reproduction.',
    }, { now });
    const loaded = await loadOutcomes(filePath);

    expect(appended.schemaVersion).toBe(1);
    expect(appended.timestamp).toBe(now.toISOString());
    expect(loaded).toEqual([appended]);
    expect((await readFile(filePath, 'utf8')).split('\n')).toHaveLength(2);
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it('redacts common credentials and private keys during serialization and parsing', () => {
    const npmToken = ['npm', 'abcdefghijklmnopqrstuvwxyz123456'].join('_');
    const slackToken = ['xoxb', '1234567890', 'abcdefghijklmnop'].join('-');
    const awsAccessKey = ['AKIA', '1234567890ABCDEF'].join('');
    const openAiToken = ['sk', 'abcdefghijklmnopqrstuvwxyz'].join('-');
    const githubToken = ['github', 'pat', 'abcdefghijklmnopqrstuvwxyz123456'].join('_');
    const privateKey = [
      ['-----BEGIN', 'PRIVATE KEY-----'].join(' '),
      'sensitive-private-key-material',
      ['-----END', 'PRIVATE KEY-----'].join(' '),
    ].join('\n');
    const record: OutcomeRecord = {
      schemaVersion: 1,
      candidateUrl: 'https://example.com/fix?token=plain-secret',
      problemFingerprint: 'fingerprint',
      outcome: 'unsafe',
      notes: [
        `Authorization: Bearer ${openAiToken}`,
        githubToken,
        npmToken,
        slackToken,
        awsAccessKey,
        privateKey,
      ].join('\n'),
      timestamp: '2026-07-23T04:05:06.000Z',
    };

    const serialized = serializeOutcomeRecord(record);
    const parsed = parseOutcomeRecord(serialized);

    expect(serialized).not.toContain('plain-secret');
    expect(serialized).not.toContain(openAiToken);
    expect(serialized).not.toContain(githubToken);
    expect(serialized).not.toContain(npmToken);
    expect(serialized).not.toContain(slackToken);
    expect(serialized).not.toContain(awsAccessKey);
    expect(serialized).not.toContain('sensitive-private-key-material');
    expect(parsed.candidateUrl).toContain('[REDACTED]');
    expect(parsed.notes).toContain('[REDACTED]');
  });

  it('rejects malformed records with their JSONL line number', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fixseek-outcomes-'));
    const filePath = join(directory, 'outcomes.jsonl');
    await writeFile(filePath, [
      '{"schemaVersion":1,"candidateUrl":"https://example.com/a","problemFingerprint":"abc","outcome":"useful","timestamp":"2026-07-23T04:05:06.000Z"}',
      '{"schemaVersion":1,"candidateUrl":"not-a-url","problemFingerprint":"","outcome":"maybe","timestamp":"yesterday"}',
      '',
    ].join('\n'), 'utf8');

    await expect(loadOutcomes(filePath)).rejects.toThrow(
      /Malformed outcome record at line 2/,
    );
  });

  it('returns an empty list when the JSONL file does not exist', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fixseek-outcomes-'));
    await expect(loadOutcomes(join(directory, 'missing.jsonl'))).resolves.toEqual([]);
  });
});
