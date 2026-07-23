import { PassThrough, Writable } from 'stream';
import { createProgram, runSolve, type CliIo } from '../src/cli/index';
import { resetProviderRuntimeForTests } from '../src/providers/provider-runtime';
import packageJson from '../package.json';

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

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  resetProviderRuntimeForTests();
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
  process.exitCode = undefined;
});

describe('Fixseek CLI UX', () => {
  it('supports direct query usage without solve', async () => {
    const { io, stdout, stderr } = makeIo();
    const program = createProgram(io);
    await program.parseAsync([
      'node',
      'fixseek',
      '--mock',
      '--max-results',
      '1',
      'reasoning_content error with Claude Code',
    ]);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stdout.text()).toContain('Fixseek');
    expect(stdout.text()).toContain('oc-go-cc');
    expect(stderr.text()).toBe('');
    process.exitCode = undefined;
  });

  it('supports solve compatibility usage', async () => {
    const { io, stdout } = makeIo();
    const program = createProgram(io);
    await program.parseAsync([
      'node',
      'fixseek',
      'solve',
      '--mock',
      '--max-results',
      '1',
      'reasoning_content error with Claude Code',
    ]);

    expect(process.exitCode ?? 0).toBe(0);
    expect(stdout.text()).toContain('Top matches');
    process.exitCode = undefined;
  });

  it('supports stdin input', async () => {
    const { io, stdout } = makeIo('reasoning_content error with Claude Code');
    const code = await runSolve(
      [],
      { stdin: true, mock: true, maxResults: '1', logLevel: 'warn', lang: 'en' },
      io,
    );

    expect(code).toBe(0);
    expect(stdout.text()).toContain('reasoning_content');
  });

  it('shows concise help with Fixseek examples', async () => {
    const { io, stdout, stderr } = makeIo();
    const program = createProgram(io);
    program.exitOverride();
    program.configureOutput({
      writeOut: (str) => stdout.write(str),
      writeErr: (str) => stderr.write(str),
    });

    await expect(program.parseAsync(['node', 'fixseek', '--help'])).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
    });

    const help = stdout.text();
    expect(help).toContain('Fixseek');
    expect(help).toContain('find existing fixes');
    expect(help).toContain('fixseek "reasoning_content error with Claude Code + DeepSeek"');
    expect(help).toContain('cat error.log | fixseek --stdin');
    expect(help).toContain('fixseek --json');
    expect(help).toContain('fixseek --real');
    expect(help).toContain('fixseek --lang zh');
    expect(help).toContain('fixseek --max-results 5');
    expect(help).toContain('solve "problem"');
    expect(help).toContain('compatibility subcommand');
    expect(help).not.toContain('tool-resolver');
  });

  it('package bin points to fixseek', () => {
    expect(packageJson.name).toBe('fixseek');
    expect(packageJson.bin).toEqual({ fixseek: 'dist/cli/index.js' });
  });

  it('includes GitHub issue candidates in real GitHub mode', async () => {
    process.env.GITHUB_TOKEN = 'ghp_test_token';
    process.env.MAX_RESULTS_PER_PROVIDER = '10';
    process.env.REQUEST_TIMEOUT_MS = '1000';

    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/search/repositories')) {
        return new Response(JSON.stringify({ total_count: 0, items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/search/issues')) {
        return new Response(JSON.stringify({
          total_count: 1,
          items: [{
            html_url: 'https://github.com/owner/repo/issues/2365',
            title: 'DeepSeek reasoning_content error',
            body: 'Claude Code users report reasoning_content failures.',
            number: 2365,
            state: 'open',
            repository_url: 'https://api.github.com/repos/owner/repo',
            created_at: '2026-04-01T00:00:00Z',
            updated_at: '2026-05-01T00:00:00Z',
            user: { type: 'User' },
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;

    const { io, stdout, stderr } = makeIo();
    const code = await runSolve(
      ['reasoning_content error with Claude Code'],
      {
        real: true,
        provider: 'github',
        maxResults: '3',
        logLevel: 'warn',
        lang: 'en',
      },
      io,
    );

    expect(code).toBe(0);
    expect(stdout.text()).toContain('owner/repo#2365');
    expect(stdout.text()).toContain('Type: 🐛 Issue');
    expect(stdout.text()).toContain('Read the issue thread');
    expect(stderr.text()).toBe('');
  });

  it('reports providers skipped for missing credentials', async () => {
    process.env.GITHUB_TOKEN = '';
    process.env.WEB_SEARCH_API_KEY = '';
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ objects: [] }), { status: 200 })) as unknown as typeof fetch;

    const { io, stdout, stderr } = makeIo();
    const code = await runSolve(
      ['vite module not found'],
      {
        real: true,
        maxResults: '1',
        logLevel: 'warn',
        lang: 'en',
      },
      io,
    );

    expect(code).toBe(0);
    expect(stdout.text()).toContain('No results found');
    expect(stderr.text()).toContain('Provider skipped: github. GitHub token is not configured.');
    expect(stderr.text()).toContain('Provider skipped: web. Web search key is not configured.');
  });
});
