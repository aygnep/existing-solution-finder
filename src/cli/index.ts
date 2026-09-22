#!/usr/bin/env node
import { Command } from 'commander';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import { discoverSolutions } from '../core/discovery-service.js';
import { summarize } from '../core/summarizer.js';
import { createDiscoverySearchers } from '../providers/discovery-searchers.js';
import {
  appendOutcome,
  fingerprintProblem,
  redactSensitiveText,
} from '../feedback/index.js';
import { parseLanguage, t } from '../i18n/messages.js';
import type { Provider } from '../types/candidate.js';
import type { CandidateOutcome } from '../types/feedback.js';
import type { Language } from '../i18n/types.js';
import {
  loadContextFile,
  mergeCliContext,
  type ContextFileInput,
} from './context.js';
import {
  createDiscoveryEnvelope,
  createErrorEnvelope,
  createFeedbackEnvelope,
  type AgentInvocationMetadata,
  type FeedbackInvocationMetadata,
} from './json-output.js';

const VALID_PROVIDERS: readonly Provider[] = ['github', 'web', 'npm'];
const VALID_OUTCOMES: readonly CandidateOutcome[] = [
  'useful',
  'not-useful',
  'unsafe',
];
const DESCRIPTION =
  'Fixseek helps you find existing fixes, tools, GitHub issues, packages, and workarounds before you build from scratch.';

export interface CliOptions {
  readonly stdin?: boolean;
  readonly maxResults: string;
  readonly mock?: boolean;
  readonly real?: boolean;
  readonly provider?: string;
  readonly stack?: string;
  readonly constraints?: string;
  readonly contextFile?: string;
  readonly json?: boolean;
  readonly lang?: string;
  readonly logLevel: string;
}

export interface CliIo {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

export interface FeedbackCliOptions {
  readonly problem?: string;
  readonly problemFingerprint?: string;
  readonly candidateUrl?: string;
  readonly outcome?: string;
  readonly notes?: string;
  readonly outcomeFile?: string;
  readonly json?: boolean;
}

export interface FeedbackRunDependencies {
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDirectory?: string;
  readonly now?: Date;
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
    .version('0.2.0-beta.1')
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
      process.exitCode = await runSolve(
        problemParts,
        normalizeOptions({ ...program.opts(), ...solve.opts(), ...options }),
        io,
      );
    });

  addSolveOptions(solve);

  const feedback = program
    .command('feedback')
    .description('Record whether a Fixseek candidate was useful, not useful, or unsafe.')
    .option('--problem <text>', 'Problem text to fingerprint before storing')
    .option('--problem-fingerprint <hash>', 'Existing problem fingerprint')
    .option('--candidate-url <url>', 'Candidate HTTP(S) URL')
    .option('--outcome <value>', 'Outcome: useful | not-useful | unsafe')
    .option('--notes <text>', 'Observed result or safety notes')
    .option('--outcome-file <path>', 'JSONL outcome file path')
    .option('--json', 'Emit a stable machine-readable feedback envelope')
    .action(async () => {
      process.exitCode = await runFeedback(
        { ...program.opts(), ...feedback.opts() },
        io,
      );
    });

  return program;
}

export async function runSolve(
  problemParts: readonly string[],
  options: CliOptions,
  io: CliIo = defaultIo(),
): Promise<number> {
  const resolvedOptions = normalizeOptions(options);
  let lang: Language;
  try {
    lang = parseLanguage(resolvedOptions.lang);
  } catch (err) {
    return writeCliError('invalid_language', String((err as Error).message), resolvedOptions, io);
  }

  if (resolvedOptions.mock && resolvedOptions.real) {
    return writeCliError(
      'conflicting_modes',
      '--mock and --real cannot be used together.',
      resolvedOptions,
      io,
    );
  }

  logger.setLevel(
    resolvedOptions.json
      ? 'error'
      : resolvedOptions.logLevel as 'debug' | 'info' | 'warn' | 'error',
  );

  let problemText = problemParts.join(' ').trim();
  let inputSource: AgentInvocationMetadata['input']['source'] = 'arguments';
  if (resolvedOptions.stdin) {
    logger.info(t(lang, 'readingFromStdin'));
    problemText = (await readStdin(io.stdin)).trim();
    inputSource = 'stdin';
  }

  let fileContext: ContextFileInput | undefined;
  if (resolvedOptions.contextFile) {
    try {
      fileContext = await loadContextFile(resolvedOptions.contextFile);
    } catch (error) {
      return writeCliError(
        'invalid_context_file',
        error instanceof Error ? error.message : String(error),
        resolvedOptions,
        io,
      );
    }
  }

  if (!problemText && fileContext?.problem?.trim()) {
    inputSource = 'context-file';
  }

  const context = mergeCliContext({
    cliProblem: problemText,
    cliStack: resolvedOptions.stack,
    cliConstraints: resolvedOptions.constraints,
    fileContext,
  });

  if (!context.problem.trim()) {
    return writeCliError(
      'input_required',
      `${t(lang, 'error')}: ${t(lang, 'inputRequired')}.`,
      resolvedOptions,
      io,
    );
  }

  const mode = resolvedOptions.mock ? 'mock' : 'real';

  let selectedProvider: Provider | undefined;
  if (resolvedOptions.provider) {
    const normalized = resolvedOptions.provider.toLowerCase();
    if (!VALID_PROVIDERS.includes(normalized as Provider)) {
      return writeCliError(
        'unsupported_provider',
        `${t(lang, 'error')}: ${t(lang, 'unsupportedProvider')} "${resolvedOptions.provider}". Valid options: github, web, npm.`,
        resolvedOptions,
        io,
      );
    }
    selectedProvider = normalized as Provider;
  }

  const maxResultsText = resolvedOptions.maxResults.trim();
  const maxResults = Number(maxResultsText);
  if (
    !/^[1-9]\d*$/.test(maxResultsText) ||
    !Number.isSafeInteger(maxResults)
  ) {
    return writeCliError(
      'invalid_max_results',
      '--max-results must be a positive integer.',
      resolvedOptions,
      io,
    );
  }

  const providers = selectedProvider ? [selectedProvider] : VALID_PROVIDERS;
  logger.info('Analyzing problem...', { length: context.problem.length });
  const searchers = await createDiscoverySearchers(mode);
  const result = await discoverSolutions({
    request: {
      problem: context.problem,
      stack: context.stack,
      constraints: context.constraints,
      providers,
      mode,
      maxResults,
    },
    now: new Date(),
    searchers,
  });

  if (resolvedOptions.json) {
    const invocation: AgentInvocationMetadata = {
      command: 'solve',
      mode,
      explicitMode: resolvedOptions.mock ? 'mock' : resolvedOptions.real ? 'real' : 'default',
      language: lang,
      providers,
      maxResults,
      input: {
        source: inputSource,
        contextFileLoaded: fileContext !== undefined,
        attemptedFixesCount: context.attemptedFixes.length,
        environmentKeys: Object.keys(context.environment),
      },
      mergePolicy: {
        problem: 'cli-or-stdin-over-context-file',
        stack: 'context-file-then-cli-deduplicated',
        constraints: 'context-file-then-cli-deduplicated',
      },
    };
    io.stdout.write(JSON.stringify(createDiscoveryEnvelope(invocation, result), null, 2) + '\n');
    return 0;
  }

  writeProviderWarnings(result.providerStatus, lang, io);
  io.stdout.write(summarize(result.candidates, result.parsedProblem, { lang }));
  return 0;
}

export async function runFeedback(
  options: FeedbackCliOptions,
  io: CliIo = defaultIo(),
  dependencies: FeedbackRunDependencies = {},
): Promise<number> {
  const problem = options.problem?.trim();
  const suppliedFingerprint = options.problemFingerprint?.trim();
  const hasProblem = Boolean(problem);
  const hasFingerprint = Boolean(suppliedFingerprint);

  if (hasProblem === hasFingerprint) {
    return writeCliError(
      'feedback_problem_input',
      'Exactly one of --problem or --problem-fingerprint is required.',
      options,
      io,
    );
  }

  const candidateUrl = options.candidateUrl?.trim();
  if (!candidateUrl) {
    return writeCliError(
      'feedback_candidate_url_required',
      '--candidate-url is required.',
      options,
      io,
    );
  }

  const outcome = options.outcome?.trim().toLowerCase();
  if (!VALID_OUTCOMES.includes(outcome as CandidateOutcome)) {
    return writeCliError(
      'feedback_invalid_outcome',
      '--outcome must be one of: useful, not-useful, unsafe.',
      options,
      io,
    );
  }

  const environment = dependencies.env ?? process.env;
  const outcomeFile = resolveOutcomeFile(
    options.outcomeFile,
    environment.FIXSEEK_OUTCOME_FILE,
    dependencies.homeDirectory ?? homedir(),
  );

  let problemFingerprint: string;
  try {
    problemFingerprint = hasProblem
      ? fingerprintProblem(problem!)
      : suppliedFingerprint!;
  } catch (error) {
    return writeCliError(
      'feedback_invalid_problem',
      redactSensitiveText(error instanceof Error ? error.message : String(error)),
      options,
      io,
    );
  }

  try {
    const record = await appendOutcome(
      outcomeFile,
      {
        candidateUrl,
        problemFingerprint,
        outcome: outcome as CandidateOutcome,
        ...(options.notes === undefined ? {} : { notes: options.notes.trim() }),
      },
      dependencies.now ? { now: dependencies.now } : {},
    );
    const invocation: FeedbackInvocationMetadata = {
      command: 'feedback',
      problemInput: hasProblem ? 'problem' : 'problem-fingerprint',
      outcomeFile,
    };

    if (options.json) {
      io.stdout.write(
        JSON.stringify(createFeedbackEnvelope(invocation, record), null, 2) + '\n',
      );
    } else {
      io.stdout.write(
        [
          `Recorded ${record.outcome} feedback for ${record.candidateUrl}.`,
          `Problem fingerprint: ${record.problemFingerprint}`,
          `Outcome file: ${redactSensitiveText(outcomeFile)}`,
          '',
        ].join('\n'),
      );
    }
    return 0;
  } catch (error) {
    return writeCliError(
      'feedback_write_failed',
      redactSensitiveText(error instanceof Error ? error.message : String(error)),
      options,
      io,
    );
  }
}

function writeProviderWarnings(
  statuses: readonly { provider: Provider; state: string; message?: string }[],
  lang: Language,
  io: CliIo,
): void {
  for (const status of statuses) {
    if (status.state !== 'skipped' && status.state !== 'failed' && status.state !== 'partial') continue;
    const label = status.state === 'partial'
      ? (lang === 'zh' ? '来源部分成功' : 'Provider partially completed')
      : status.state === 'skipped' ? t(lang, 'providerSkipped') : t(lang, 'providerFailed');
    const detail = status.message ? ` ${status.message}` : '';
    io.stderr.write(`${label}: ${status.provider}.${detail}\n`);
  }
}

function addSolveOptions(command: Command): void {
  command
    .option('--stdin', 'Read problem from stdin instead of an argument')
    .option('--max-results <n>', 'Maximum results to show')
    .option('--mock', 'Use mock providers for tests and demos (no API calls)')
    .option('--real', 'Explicitly use real providers (accepted for compatibility; this is the default)')
    .option('--provider <name>', 'Limit to a provider: github | web | npm')
    .option('--stack <list>', 'Comma-separated stack context, e.g. "Node.js,Docker"')
    .option('--constraints <list>', 'Comma-separated constraints, e.g. "open source,no cloud"')
    .option('--context-file <path>', 'Read agent context from a JSON file')
    .option('--json', 'Emit a stable machine-readable agent envelope')
    .option('--lang <lang>', 'Output language: en | zh')
    .option('--log-level <level>', 'Log level: debug | info | warn | error');
}

function normalizeOptions(options: CliOptions): CliOptions {
  return { ...DEFAULT_OPTIONS, ...options };
}

function helpExamples(): string {
  return `
Examples:
  fixseek "reasoning_content error with Claude Code + DeepSeek"
  cat error.log | fixseek --stdin
  fixseek --json "vite module not found"
  fixseek feedback --problem "vite error" --candidate-url https://example.com/fix --outcome useful
  fixseek --lang zh "reasoning_content 报错"
  fixseek --max-results 5 "npm package ESM CommonJS error"

Advanced (still supported):
  fixseek solve "problem"        # compatibility subcommand
  fixseek --provider github ...  # limit to one provider
  fixseek --stack "Node.js,Docker" ...
  fixseek --constraints "open source,no cloud" ...
  fixseek --context-file context.json ...
  fixseek --mock ...             # explicit test/demo mode
  fixseek --real ...             # explicit compatibility flag
  fixseek --log-level debug ...
`;
}

function writeCliError(
  code: string,
  message: string,
  options: { readonly json?: boolean },
  io: CliIo,
): 1 {
  if (options.json) {
    io.stdout.write(JSON.stringify(createErrorEnvelope(code, message), null, 2) + '\n');
  } else {
    io.stderr.write(message + '\n');
  }
  return 1;
}

function resolveOutcomeFile(
  explicitPath: string | undefined,
  environmentPath: string | undefined,
  homeDirectory: string,
): string {
  return (
    explicitPath?.trim() ||
    environmentPath?.trim() ||
    join(homeDirectory, '.config', 'fixseek', 'outcomes.jsonl')
  );
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
