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

const program = new Command();

program
  .name('tool-resolver')
  .description('Find existing tools and projects that solve your technical problem')
  .version('0.1.0');

program
  .command('solve [problem]', { isDefault: true })
  .description('Analyze a problem and find matching tools')
  .option('--stdin', 'Read problem from stdin instead of argument')
  .option('--max-results <n>', 'Maximum results to show', '10')
  .option('--mock', 'Use mock provider (default, no API calls)')
  .option('--real', 'Use real providers (requires API keys)')
  .option('--provider <name>', 'Limit to specific provider: github | web | npm')
  .option('--lang <lang>', 'Output language: en | zh', 'en')
  .option('--log-level <level>', 'Log level: debug | info | warn | error', 'info')
  .action(async (problemArg: string | undefined, options: {
    stdin?: boolean;
    maxResults: string;
    mock?: boolean;
    real?: boolean;
    provider?: string;
    lang?: string;
    logLevel: string;
  }) => {
    let lang: Language;
    try {
      lang = parseLanguage(options.lang);
    } catch (err) {
      process.stderr.write(String((err as Error).message) + '\n');
      process.exit(1);
    }

    logger.setLevel(options.logLevel as 'debug' | 'info' | 'warn' | 'error');

    // Collect problem input
    let problemText = problemArg ?? '';
    if (options.stdin) {
      logger.info(t(lang, 'readingFromStdin'));
      problemText = await readStdin();
    }

    if (!problemText?.trim()) {
      process.stderr.write(`${t(lang, 'error')}: ${t(lang, 'inputRequired')}.\n`);
      process.exit(1);
    }

    // Resolve mode: --real takes precedence; default is mock
    const useReal = options.real === true;
    const useMock = !useReal;

    // Validate --provider value
    let selectedProvider: Provider | undefined;
    if (options.provider) {
      const normalized = options.provider.toLowerCase();
      if (!VALID_PROVIDERS.includes(normalized as Provider)) {
        process.stderr.write(
          `${t(lang, 'error')}: ${t(lang, 'unsupportedProvider')} "${options.provider}". Valid options: github, web, npm.\n`,
        );
        process.exit(1);
      }
      selectedProvider = normalized as Provider;
    }

    logger.info('Analyzing problem...', { length: problemText.length });

    // 1. Parse
    const problem = parseProblem(problemText);
    logger.debug('Parsed problem', {
      errorTokens: problem.errorTokens.length,
      stackNames: problem.stackNames.length,
      keywords: problem.keywords.length,
    });

    // 2. Generate queries
    const queries = generateQueries(problem);
    logger.info(`Generated ${queries.length} queries`);

    // 3. Search
    let allCandidates: RawCandidate[];

    if (useMock) {
      logger.info(t(lang, 'mockMode') + ' (no real API calls)');
      const mockSearch = createMockProvider(getBuiltinMockCandidates());
      const results = await Promise.all(queries.map((q) => mockSearch(q)));
      allCandidates = results.flat();
    } else {
      // Real provider path — validate environment
      const { loadEnv } = await import('../utils/env.js');

      let env;
      try {
        env = loadEnv();
      } catch (err) {
        process.stderr.write(String(err) + '\n');
        process.exit(1);
      }

      // If --real is used and github is needed, GITHUB_TOKEN must be present
      const needsGitHub =
        !selectedProvider || selectedProvider === 'github';
      if (needsGitHub && !env.GITHUB_TOKEN) {
        process.stderr.write(
          `${t(lang, 'error')}: ${t(lang, 'missingGithubToken')}.\n` +
            'Create a token at https://github.com/settings/tokens (scope: public_repo)\n' +
            'Then run: GITHUB_TOKEN=your_token npm start -- solve --real "your problem"\n',
        );
        process.exit(1);
      }

      const { searchGitHubMultiQuery } = await import('../providers/github-search.js');
      const { searchWeb } = await import('../providers/web-search.js');
      const { searchPackages } = await import('../providers/package-search.js');

      allCandidates = [];

      // GitHub: use multi-query search with built-in deduplication
      if (!selectedProvider || selectedProvider === 'github') {
        const githubQueries = queries.filter((q) => q.providers.includes('github'));
        try {
          const githubResults = await searchGitHubMultiQuery(githubQueries, env);
          allCandidates.push(...githubResults);
        } catch (err: unknown) {
          logger.warn('GitHub search failed', { error: String(err) });
        }
      }

      // Web and npm: per-query search
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
    }

    logger.info(`Found ${allCandidates.length} raw candidates`);

    // 4. Score
    const scored = allCandidates.map((c) => scoreAndAttach(c, problem));

    // 5. Rank
    const ranked = rankCandidates(scored, {
      maxResults: parseInt(options.maxResults, 10),
    });

    // 6. Output
    const output = summarize(ranked, problem, { lang });
    process.stdout.write(output);
  });

program.parse();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.resume();
  });
}
