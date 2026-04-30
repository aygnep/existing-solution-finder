import { PassThrough, Writable } from 'stream';
import { createProgram, runSolve, type CliIo } from '../src/cli/index';
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

describe('Fixseek CLI UX', () => {
  it('supports default query usage without solve', async () => {
    const { io, stdout, stderr } = makeIo();
    const program = createProgram(io);
    await program.parseAsync([
      'node',
      'fixseek',
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
      { stdin: true, maxResults: '1', logLevel: 'warn', lang: 'en' },
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
    expect(help).toContain('fixseek solve "npm package ESM CommonJS error"');
    expect(help).not.toContain('tool-resolver');
  });

  it('package bin points to fixseek', () => {
    expect(packageJson.name).toBe('fixseek');
    expect(packageJson.bin).toEqual({ fixseek: 'dist/cli/index.js' });
  });
});
