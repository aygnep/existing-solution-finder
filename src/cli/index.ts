#!/usr/bin/env node
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { parseProblem } from '../core/problem-parser.js';
import { generateQueries } from '../core/query-generator.js';
import { scoreAndAttach } from '../core/scorer.js';
import { rankCandidates } from '../core/ranker.js';
import { summarize } from '../core/summarizer.js';
import { createMockProvider, getBuiltinMockCandidates } from '../providers/mock-provider.js';
import { parseLanguage, t } from '../i18n/messages.js';
import type { Provider, RawCandidate } from '../types/candidate.js';
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

  const problem = parseProblem(problemText);
  logger.debug('Parsed problem', {
    errorTokens: problem.errorTokens.length,
    stackNames: problem.stackNames.length,
    keywords: problem.keywords.length,
  });

  const queries = generateQueries(problem);
  logger.info(`Generated ${queries.length} queries`);

  let allCandidates: RawCandidate[];

  if (useMock) {
    logger.info(t(lang, 'mockMode') + ' (no real API calls)');
    const mockSearch = createMockProvider(getBuiltinMockCandidates());
    const results = await Promise.all(queries.map((q) => mockSearch(q)));
    allCandidates = results.flat();
  } else {
    allCandidates = await searchRealProviders(queries, selectedProvider, lang, io);
    if (allCandidates.length === 0 && process.exitCode === 1) return 1;
  }

  logger.info(`Found ${allCandidates.length} raw candidates`);

  const scored = allCandidates.map((c) => scoreAndAttach(c, problem));
  const ranked = rankCandidates(scored, {
    maxResults: parseInt(options.maxResults, 10),
  });

  io.stdout.write(summarize(ranked, problem, { lang }));
  return 0;
}

async function searchRealProviders(
  queries: ReturnType<typeof generateQueries>,
  selectedProvider: Provider | undefined,
  lang: Language,
  io: CliIo,
): Promise<RawCandidate[]> {
  const { loadEnv } = await import('../utils/env.js');

  let env;
  try {
    env = loadEnv();
  } catch (err) {
    io.stderr.write(String(err) + '\n');
    process.exitCode = 1;
    return [];
  }

  const needsGitHub = !selectedProvider || selectedProvider === 'github';
  if (needsGitHub && !env.GITHUB_TOKEN) {
    io.stderr.write(
      `${t(lang, 'error')}: ${t(lang, 'missingGithubToken')}.\n` +
        'Create a token at https://github.com/settings/tokens (scope: public_repo)\n' +
        'Then run: GITHUB_TOKEN=your_token fixseek --real "your problem"\n',
    );
    process.exitCode = 1;
    return [];
  }

  const { searchGitHubMultiQuery } = await import('../providers/github-search.js');
  const { searchWeb } = await import('../providers/web-search.js');
  const { searchPackages } = await import('../providers/package-search.js');
  const allCandidates: RawCandidate[] = [];

  if (!selectedProvider || selectedProvider === 'github') {
    const githubQueries = queries.filter((q) => q.providers.includes('github'));
    try {
      allCandidates.push(...await searchGitHubMultiQuery(githubQueries, env));
    } catch (err: unknown) {
      logger.warn('GitHub search failed', { error: String(err) });
    }
  }

  const otherPromises = queries.flatMap((query) => {
    const promises: Promise<void>[] = [];

    if (query.providers.includes('web') && (!selectedProvider || selectedProvider === 'web')) {
      promises.push(
        searchWeb(query, env).then((results) => {
          allCandidates.push(...results);
        }).catch((err: unknown) => {
          logger.warn('Web search failed', { error: String(err) });
        }),
      );
    }
    if (query.providers.includes('npm') && (!selectedProvider || selectedProvider === 'npm')) {
      promises.push(
        searchPackages(query, env).then((results) => {
          allCandidates.push(...results);
        }).catch((err: unknown) => {
          logger.warn('npm search failed', { error: String(err) });
        }),
      );
    }
    return promises;
  });

  await Promise.all(otherPromises);
  return allCandidates;
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
  fixseek --real --provider github "vite module not found"
  fixseek --stack "Node.js,Docker" "container networking issue"
  fixseek solve "npm package ESM CommonJS error"

Default usage does not require the solve command; solve is kept for compatibility.
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
