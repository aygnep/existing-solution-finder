#!/usr/bin/env node
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { discoverSolutions } from '../core/discovery-service.js';
import { summarize } from '../core/summarizer.js';
import { createDiscoverySearchers } from '../providers/discovery-searchers.js';
import { parseLanguage, t } from '../i18n/messages.js';
import type { Provider } from '../types/candidate.js';
import type { Language } from '../i18n/types.js';

const VALID_PROVIDERS: readonly Provider[] = ['github', 'web', 'npm'];
const DESCRIPTION =
  'Fixseek helps you find existing fixes, tools, GitHub issues, packages, and workarounds before you build from scratch.';

export interface CliOptions {
  readonly stdin?: boolean;
  readonly maxResults: string;
  readonly mock?: boolean;
  readonly real?: boolean;
  readonly provider?: string;
  readonly stack?: string;
  readonly lang?: string;
  readonly logLevel: string;
}

export interface CliIo {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

const DEFAULT_OPTIONS: CliOptions = {
  maxResults: '10',
  lang: 'en',
  logLevel: 'warn',
};

export function createProgram(io: CliIo = defaultIo()): Command {
  const program = new Command();

  program
    .name('fixseek')
    .description(DESCRIPTION)
    .version('0.1.0')
    .argument('[problem...]', 'Problem description, error message, or keywords')
    .allowExcessArguments(false)
    .showHelpAfterError()
    .addHelpText('after', helpExamples())
    .action(async (problemParts: readonly string[] = [], options: CliOptions) => {
      process.exitCode = await runSolve(problemParts, normalizeOptions(options), io);
    });

  addSolveOptions(program);

  const solve = program
    .command('solve')
    .description('Compatibility command. Same as running fixseek "problem".')
    .argument('[problem...]', 'Problem description, error message, or keywords')
    .allowExcessArguments(false)
    .showHelpAfterError()
    .addHelpText('after', helpExamples())
    .action(async (problemParts: readonly string[] = [], options: CliOptions) => {
      process.exitCode = await runSolve(problemParts, normalizeOptions(options), io);
    });

  addSolveOptions(solve);

  return program;
}

export async function runSolve(
  problemParts: readonly string[],
  options: CliOptions,
  io: CliIo = defaultIo(),
): Promise<number> {
  let lang: Language;
  try {
    lang = parseLanguage(options.lang);
  } catch (err) {
    io.stderr.write(String((err as Error).message) + '\n');
    return 1;
  }

  logger.setLevel(options.logLevel as 'debug' | 'info' | 'warn' | 'error');

  let problemText = problemParts.join(' ').trim();
  if (options.stdin) {
    logger.info(t(lang, 'readingFromStdin'));
    problemText = (await readStdin(io.stdin)).trim();
  }

  problemText = appendStackContext(problemText, options.stack);

  if (!problemText.trim()) {
    io.stderr.write(`${t(lang, 'error')}: ${t(lang, 'inputRequired')}.\n`);
    return 1;
  }

  const useReal = options.real === true;
  const useMock = !useReal;

  let selectedProvider: Provider | undefined;
  if (options.provider) {
    const normalized = options.provider.toLowerCase();
    if (!VALID_PROVIDERS.includes(normalized as Provider)) {
      io.stderr.write(
        `${t(lang, 'error')}: ${t(lang, 'unsupportedProvider')} "${options.provider}". Valid options: github, web, npm.\n`,
      );
      return 1;
    }
    selectedProvider = normalized as Provider;
  }

  logger.info('Analyzing problem...', { length: problemText.length });
  const searchers = await createDiscoverySearchers(useMock ? 'mock' : 'real');
  const result = await discoverSolutions({
    request: {
      problem: problemText,
      stack: [],
      constraints: [],
      providers: selectedProvider ? [selectedProvider] : VALID_PROVIDERS,
      mode: useMock ? 'mock' : 'real',
      maxResults: parseInt(options.maxResults, 10),
    },
    now: new Date(),
    searchers,
  });

  writeProviderWarnings(result.providerStatus, lang, io);
  io.stdout.write(summarize(result.candidates, result.parsedProblem, { lang }));
  return 0;
}

function writeProviderWarnings(
  statuses: readonly { provider: Provider; state: string; message?: string }[],
  lang: Language,
  io: CliIo,
): void {
  for (const status of statuses) {
    if (status.state !== 'skipped' && status.state !== 'failed') continue;
    const label = status.state === 'skipped' ? t(lang, 'providerSkipped') : t(lang, 'providerFailed');
    const detail = status.message ? ` ${status.message}` : '';
    io.stderr.write(`${label}: ${status.provider}.${detail}\n`);
  }
}

function addSolveOptions(command: Command): void {
  command
    .option('--stdin', 'Read problem from stdin instead of an argument')
    .option('--max-results <n>', 'Maximum results to show', '10')
    .option('--mock', 'Use mock provider (default, no API calls)')
    .option('--real', 'Use real providers (requires API keys)')
    .option('--provider <name>', 'Limit to a provider: github | web | npm')
    .option('--stack <list>', 'Comma-separated stack context, e.g. "Node.js,Docker"')
    .option('--lang <lang>', 'Output language: en | zh', 'en')
    .option('--log-level <level>', 'Log level: debug | info | warn | error', 'warn');
}

function normalizeOptions(options: CliOptions): CliOptions {
  return { ...DEFAULT_OPTIONS, ...options };
}

function appendStackContext(problemText: string, stack: string | undefined): string {
  if (!stack?.trim()) return problemText;
  const normalizedStack = stack
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');

  if (!normalizedStack) return problemText;
  return [problemText, `Stack: ${normalizedStack}`].filter(Boolean).join('\n');
}

function helpExamples(): string {
  return `
Examples:
  fixseek "reasoning_content error with Claude Code + DeepSeek"
  cat error.log | fixseek --stdin
  fixseek --real "vite module not found"
  fixseek --lang zh "reasoning_content 报错"
  fixseek --max-results 5 "npm package ESM CommonJS error"

Advanced (still supported):
  fixseek solve "problem"        # compatibility subcommand
  fixseek --provider github ...  # limit to one provider
  fixseek --stack "Node.js,Docker" ...
  fixseek --mock ...             # force mock mode
  fixseek --log-level debug ...
`;
}

function defaultIo(): CliIo {
  return {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

async function readStdin(stdin: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stdin.resume();
  });
}

if (require.main === module) {
  void createProgram().parseAsync(process.argv);
}
