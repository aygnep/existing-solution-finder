import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { createProgram, runSolve, type CliIo } from '../src/cli/index';
import { sanitizeForOutput } from '../src/cli/context';
import { resetProviderRuntimeForTests } from '../src/providers/provider-runtime';

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

function makeIo(stdinText = ''): { io: CliIo; stdout: CaptureStream; stderr: CaptureStream } {
  const stdin = new PassThrough();
  const stdout = new CaptureStream();
  const stderr = new CaptureStream();
  stdin.end(stdinText);
  return { io: { stdin, stdout, stderr }, stdout, stderr };
}

const originalEnv = { ...process.env };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  resetProviderRuntimeForTests();
  process.env = { ...originalEnv };
  process.exitCode = undefined;
  jest.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe('Fixseek agent-first CLI workflow', () => {
  it('uses real providers by default while accepting explicit --real', async () => {
    process.env.GITHUB_TOKEN = '';

    for (const real of [undefined, true]) {
      const { io, stdout, stderr } = makeIo();
      const code = await runSolve(
        ['vite module not found'],
        {
          ...(real ? { real } : {}),
          json: true,
          provider: 'github',
          maxResults: '1',
          logLevel: 'warn',
          lang: 'en',
        },
        io,
      );

      expect(code).toBe(0);
      const envelope = JSON.parse(stdout.text());
      expect(envelope.result.request.mode).toBe('real');
      expect(envelope.invocation.explicitMode).toBe(real ? 'real' : 'default');
      expect(stderr.text()).toBe('');
    }
  });

  it('uses mock providers only when --mock is explicit', async () => {
    const { io, stdout } = makeIo();
    const code = await runSolve(
      ['reasoning_content error with Claude Code'],
      {
        mock: true,
        json: true,
        maxResults: '1',
        logLevel: 'warn',
        lang: 'en',
      },
      io,
    );

    expect(code).toBe(0);
    const envelope = JSON.parse(stdout.text());
    expect(envelope.result.request.mode).toBe('mock');
    expect(envelope.result.candidates).toHaveLength(1);
  });

  it('rejects --mock and --real together', async () => {
    const { io, stdout, stderr } = makeIo();
    const code = await runSolve(
      ['vite error'],
      {
        mock: true,
        real: true,
        json: true,
        maxResults: '1',
        logLevel: 'warn',
        lang: 'en',
      },
      io,
    );

    expect(code).toBe(1);
    expect(JSON.parse(stdout.text())).toMatchObject({
      schemaVersion: '1.1',
      kind: 'fixseek.error',
      ok: false,
      error: { code: 'conflicting_modes' },
    });
    expect(stderr.text()).toBe('');
  });

  it('emits a complete stable JSON discovery envelope', async () => {
    const { io, stdout, stderr } = makeIo();
    const code = await runSolve(
      ['reasoning_content error with Claude Code'],
      {
        mock: true,
        json: true,
        maxResults: '1',
        logLevel: 'debug',
        lang: 'en',
      },
      io,
    );

    expect(code).toBe(0);
    const envelope = JSON.parse(stdout.text());
    expect(envelope).toMatchObject({
      schemaVersion: '1.1',
      kind: 'fixseek.discovery',
      ok: true,
      invocation: {
        command: 'solve',
        mode: 'mock',
        explicitMode: 'mock',
        providers: ['github', 'web', 'npm'],
        input: { source: 'arguments', contextFileLoaded: false },
      },
      result: {
        request: { mode: 'mock' },
        parsedProblem: expect.any(Object),
        searchPlan: expect.any(Array),
        providerStatus: expect.any(Array),
        candidates: expect.any(Array),
        completedAt: expect.any(String),
      },
    });
    expect(envelope.result.candidates[0]).toEqual(expect.objectContaining({
      evidence: expect.any(Array),
      validationSteps: expect.any(Array),
    }));
    expect(stderr.text()).toBe('');
  });

  it('keeps provider warnings inside JSON instead of stderr', async () => {
    process.env.GITHUB_TOKEN = '';
    const { io, stdout, stderr } = makeIo();
    const code = await runSolve(
      ['vite module not found'],
      {
        json: true,
        provider: 'github',
        maxResults: '1',
        logLevel: 'debug',
        lang: 'en',
      },
      io,
    );

    expect(code).toBe(0);
    const envelope = JSON.parse(stdout.text());
    expect(envelope.warnings).toEqual([expect.objectContaining({
      code: 'provider_skipped',
      provider: 'github',
      state: 'skipped',
    })]);
    expect(envelope.result.providerStatus[0].state).toBe('skipped');
    expect(stderr.text()).toBe('');
  });

  it('maps stack and constraints to DiscoveryRequest fields', async () => {
    const { io, stdout } = makeIo();
    const code = await runSolve(
      ['module not found'],
      {
        mock: true,
        json: true,
        stack: 'Node.js,Docker',
        constraints: 'open source,no cloud',
        maxResults: '1',
        logLevel: 'warn',
        lang: 'en',
      },
      io,
    );

    expect(code).toBe(0);
    const request = JSON.parse(stdout.text()).result.request;
    expect(request.problem).toBe('module not found');
    expect(request.stack).toEqual(['Node.js', 'Docker']);
    expect(request.constraints).toEqual(['open source', 'no cloud']);
  });

  it('merges context predictably and redacts credentials before discovery output', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fixseek-cli-'));
    temporaryDirectories.push(directory);
    const contextFile = join(directory, 'context.json');
    await writeFile(contextFile, JSON.stringify({
      problem: 'context fallback problem',
      stack: ['Vite', 'Node.js'],
      constraints: ['offline'],
      attemptedFixes: [
        'reinstalled dependencies',
        'used token=github_pat_supersecret123456789',
      ],
      environment: {
        os: 'macOS 15',
        nodeVersion: '22.1.0',
        GITHUB_TOKEN: 'github_pat_supersecret123456789',
        arbitrarySecretBag: 'must-not-appear',
      },
    }));

    const { io, stdout } = makeIo();
    const code = await runSolve(
      ['CLI problem wins'],
      {
        mock: true,
        json: true,
        stack: 'Node.js,Docker',
        constraints: 'offline,open source',
        contextFile,
        maxResults: '1',
        logLevel: 'warn',
        lang: 'en',
      },
      io,
    );

    expect(code).toBe(0);
    const rawOutput = stdout.text();
    const envelope = JSON.parse(rawOutput);
    expect(envelope.result.request.stack).toEqual(['Vite', 'Node.js', 'Docker']);
    expect(envelope.result.request.constraints).toEqual(['offline', 'open source']);
    expect(envelope.result.request.problem).toContain('CLI problem wins');
    expect(envelope.result.request.problem).not.toContain('context fallback problem');
    expect(envelope.result.request.problem).toContain('Attempted fixes:');
    expect(envelope.result.request.problem).toContain('"os":"macOS 15"');
    expect(envelope.invocation.input).toMatchObject({
      source: 'arguments',
      contextFileLoaded: true,
      attemptedFixesCount: 2,
      environmentKeys: ['nodeVersion', 'os'],
    });
    expect(rawOutput).not.toContain('supersecret');
    expect(rawOutput).not.toContain('must-not-appear');
  });

  it('preserves long source URLs in agent JSON', async () => {
    const longUrl = 'https://github.com/olivernn/lunr-languages/tree/master/lunr.zh.js';
    expect(sanitizeForOutput({ sourceUrl: longUrl }).sourceUrl).toBe(longUrl);
    const { io, stdout } = makeIo();
    const code = await runSolve(
      ['Claude Code DeepSeek reasoning_content error'],
      { mock: true, json: true, maxResults: '10', logLevel: 'warn', lang: 'en' },
      io,
    );

    expect(code).toBe(0);
    const envelope = JSON.parse(stdout.text());
    for (const candidate of envelope.result.candidates) {
      expect(candidate.url).not.toContain('[REDACTED]');
      expect(candidate.evidence.every((item: { sourceUrl: string }) =>
        !item.sourceUrl.includes('[REDACTED]'))).toBe(true);
    }
  });

  it('uses context problem as a fallback and rejects malformed context files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fixseek-cli-'));
    temporaryDirectories.push(directory);
    const validContextFile = join(directory, 'valid.json');
    const invalidContextFile = join(directory, 'invalid.json');
    await writeFile(validContextFile, JSON.stringify({ problem: 'Vite context problem' }));
    await writeFile(invalidContextFile, '{"problem":');

    const valid = makeIo();
    expect(await runSolve([], {
      mock: true,
      json: true,
      contextFile: validContextFile,
      maxResults: '1',
      logLevel: 'warn',
      lang: 'en',
    }, valid.io)).toBe(0);
    expect(JSON.parse(valid.stdout.text())).toMatchObject({
      invocation: { input: { source: 'context-file' } },
      result: { request: { problem: 'Vite context problem' } },
    });

    const invalid = makeIo();
    expect(await runSolve([], {
      mock: true,
      contextFile: invalidContextFile,
      maxResults: '1',
      logLevel: 'warn',
      lang: 'en',
    }, invalid.io)).toBe(1);
    expect(invalid.stdout.text()).toBe('');
    expect(invalid.stderr.text()).toContain('Context file is not valid JSON');
  });

  it('still requires a problem when a context file only contains supplementary context', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fixseek-cli-'));
    temporaryDirectories.push(directory);
    const contextFile = join(directory, 'supplement-only.json');
    await writeFile(contextFile, JSON.stringify({
      attemptedFixes: ['reinstalled dependencies'],
      environment: { os: 'macOS 15' },
    }));

    const { io, stdout, stderr } = makeIo();
    expect(await runSolve([], {
      mock: true,
      contextFile,
      maxResults: '1',
      logLevel: 'warn',
      lang: 'en',
    }, io)).toBe(1);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toContain('Input required');
  });

  it('accepts agent options through the Commander entry point', async () => {
    const { io, stdout, stderr } = makeIo();
    const program = createProgram(io);
    await program.parseAsync([
      'node',
      'fixseek',
      '--mock',
      '--json',
      '--stack',
      'Node.js',
      '--constraints',
      'open source',
      'module not found',
    ]);

    expect(process.exitCode ?? 0).toBe(0);
    expect(JSON.parse(stdout.text()).result.request).toMatchObject({
      mode: 'mock',
      stack: ['Node.js'],
      constraints: ['open source'],
    });
    expect(stderr.text()).toBe('');
  });

  it('preserves explicit options through the solve compatibility command', async () => {
    const { io, stdout, stderr } = makeIo();
    const program = createProgram(io);
    await program.parseAsync([
      'node',
      'fixseek',
      'solve',
      '--mock',
      '--json',
      '--max-results',
      '1',
      '--lang',
      'zh',
      '--log-level',
      'error',
      'reasoning_content error with Claude Code',
    ]);

    expect(process.exitCode ?? 0).toBe(0);
    expect(JSON.parse(stdout.text())).toMatchObject({
      invocation: {
        mode: 'mock',
        explicitMode: 'mock',
        language: 'zh',
        maxResults: 1,
      },
      result: {
        request: {
          mode: 'mock',
          maxResults: 1,
        },
      },
    });
    expect(stderr.text()).toBe('');
  });

  it('rejects partial, fractional, zero, and unsafe max-results values', async () => {
    for (const maxResults of ['5abc', '1.5', '0', '9007199254740992']) {
      const { io, stdout, stderr } = makeIo();
      const code = await runSolve(
        ['vite module not found'],
        {
          mock: true,
          json: true,
          maxResults,
          logLevel: 'warn',
          lang: 'en',
        },
        io,
      );

      expect(code).toBe(1);
      expect(JSON.parse(stdout.text())).toMatchObject({
        kind: 'fixseek.error',
        error: { code: 'invalid_max_results' },
      });
      expect(stderr.text()).toBe('');
    }
  });
});
