import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import {
  createProgram,
  runFeedback,
  type CliIo,
} from '../src/cli/index';
import { loadOutcomes } from '../src/feedback';

class CaptureStream extends Writable {
  private readonly chunks: Buffer[] = [];

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  text(): string {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

function makeIo(): {
  io: CliIo;
  stdout: CaptureStream;
  stderr: CaptureStream;
} {
  const stdin = new PassThrough();
  const stdout = new CaptureStream();
  const stderr = new CaptureStream();
  stdin.end();
  return { io: { stdin, stdout, stderr }, stdout, stderr };
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.exitCode = undefined;
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'fixseek-feedback-cli-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('Fixseek feedback CLI', () => {
  it('records feedback through the direct function with a stable JSON envelope', async () => {
    const directory = await temporaryDirectory();
    const outcomeFile = join(directory, 'outcomes.jsonl');
    const { io, stdout, stderr } = makeIo();

    const code = await runFeedback({
      problem: 'Node.js 22 module failure',
      candidateUrl: 'https://github.com/example/tool/issues/42',
      outcome: 'useful',
      notes: 'Confirmed in an isolated test.',
      outcomeFile,
      json: true,
    }, io, {
      env: {},
      homeDirectory: directory,
      now: new Date('2026-07-23T08:09:10.000Z'),
    });

    expect(code).toBe(0);
    expect(stderr.text()).toBe('');
    expect(JSON.parse(stdout.text())).toMatchObject({
      schemaVersion: '1.2',
      kind: 'fixseek.feedback',
      ok: true,
      invocation: {
        command: 'feedback',
        problemInput: 'problem',
        outcomeFile,
      },
      result: {
        record: {
          schemaVersion: 1,
          candidateUrl: 'https://github.com/example/tool/issues/42',
          problemFingerprint: expect.any(String),
          outcome: 'useful',
          notes: 'Confirmed in an isolated test.',
          timestamp: '2026-07-23T08:09:10.000Z',
        },
      },
    });
    expect(await loadOutcomes(outcomeFile)).toHaveLength(1);
  });

  it('supports the Commander feedback entry point', async () => {
    const directory = await temporaryDirectory();
    const outcomeFile = join(directory, 'commander.jsonl');
    const { io, stdout, stderr } = makeIo();
    const program = createProgram(io);

    await program.parseAsync([
      'node',
      'fixseek',
      'feedback',
      '--problem-fingerprint',
      'problem-hash-123',
      '--candidate-url',
      'https://example.com/fix',
      '--outcome',
      'not-useful',
      '--notes',
      'Did not affect the error.',
      '--outcome-file',
      outcomeFile,
      '--json',
    ]);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stderr.text()).toBe('');
    expect(JSON.parse(stdout.text())).toMatchObject({
      kind: 'fixseek.feedback',
      invocation: {
        command: 'feedback',
        problemInput: 'problem-fingerprint',
      },
      result: {
        record: {
          problemFingerprint: 'problem-hash-123',
          outcome: 'not-useful',
        },
      },
    });
    expect(await loadOutcomes(outcomeFile)).toEqual([
      expect.objectContaining({ outcome: 'not-useful' }),
    ]);
  });

  it('uses FIXSEEK_OUTCOME_FILE before the home-directory default', async () => {
    const directory = await temporaryDirectory();
    const environmentFile = join(directory, 'environment.jsonl');
    const { io, stdout } = makeIo();

    expect(await runFeedback({
      problemFingerprint: 'fingerprint',
      candidateUrl: 'https://example.com/fix',
      outcome: 'unsafe',
      json: true,
    }, io, {
      env: { FIXSEEK_OUTCOME_FILE: environmentFile },
      homeDirectory: join(directory, 'home'),
      now: new Date('2026-07-23T08:09:10.000Z'),
    })).toBe(0);

    expect(JSON.parse(stdout.text()).invocation.outcomeFile).toBe(environmentFile);
    expect(await loadOutcomes(environmentFile)).toHaveLength(1);
  });

  it('falls back to ~/.config/fixseek/outcomes.jsonl', async () => {
    const directory = await temporaryDirectory();
    const homeDirectory = join(directory, 'home');
    const expectedFile = join(
      homeDirectory,
      '.config',
      'fixseek',
      'outcomes.jsonl',
    );
    const { io, stdout } = makeIo();

    expect(await runFeedback({
      problem: 'failure',
      candidateUrl: 'https://example.com/fix',
      outcome: 'useful',
      json: true,
    }, io, {
      env: {},
      homeDirectory,
      now: new Date('2026-07-23T08:09:10.000Z'),
    })).toBe(0);

    expect(JSON.parse(stdout.text()).invocation.outcomeFile).toBe(expectedFile);
    expect(await loadOutcomes(expectedFile)).toHaveLength(1);
  });

  it('requires exactly one problem input and keeps JSON errors on stdout', async () => {
    for (const input of [
      {},
      { problem: 'failure', problemFingerprint: 'fingerprint' },
    ]) {
      const { io, stdout, stderr } = makeIo();
      const code = await runFeedback({
        ...input,
        candidateUrl: 'https://example.com/fix',
        outcome: 'useful',
        json: true,
      }, io);

      expect(code).toBe(1);
      expect(JSON.parse(stdout.text())).toMatchObject({
        schemaVersion: '1.2',
        kind: 'fixseek.error',
        ok: false,
        error: { code: 'feedback_problem_input' },
      });
      expect(stderr.text()).toBe('');
    }
  });

  it('redacts sensitive values in the JSON envelope and JSONL record', async () => {
    const directory = await temporaryDirectory();
    const outcomeFile = join(directory, 'redacted.jsonl');
    const secret = 'github_pat_abcdefghijklmnopqrstuvwxyz123456';
    const { io, stdout, stderr } = makeIo();

    const code = await runFeedback({
      problem: 'private failure',
      candidateUrl: `https://example.com/fix?token=${secret}`,
      outcome: 'unsafe',
      notes: `Authorization: Bearer ${secret}`,
      outcomeFile,
      json: true,
    }, io, {
      env: {},
      homeDirectory: directory,
      now: new Date('2026-07-23T08:09:10.000Z'),
    });

    const stored = await readFile(outcomeFile, 'utf8');
    expect(code).toBe(0);
    expect(stderr.text()).toBe('');
    expect(stdout.text()).not.toContain(secret);
    expect(stored).not.toContain(secret);
    expect(stdout.text()).toContain('[REDACTED]');
    expect(stored).toContain('[REDACTED]');
  });

  it('returns validation and write errors through stdout in JSON mode', async () => {
    const { io, stdout, stderr } = makeIo();
    const code = await runFeedback({
      problem: 'failure',
      candidateUrl: 'not-a-url',
      outcome: 'useful',
      json: true,
    }, io);

    expect(code).toBe(1);
    expect(JSON.parse(stdout.text())).toMatchObject({
      kind: 'fixseek.error',
      ok: false,
      error: { code: 'feedback_write_failed' },
    });
    expect(stderr.text()).toBe('');
  });
});
